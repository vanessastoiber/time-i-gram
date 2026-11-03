/**
 * Smoke test of the npm package in `package-dist/` (run `yarn build-package` first, then `yarn test-package`).
 *
 * Serves `package-dist/` locally and, in headless Chromium (Playwright), opens one page per spec that imports
 * `dist/index.js` the way a plain HTML page would and calls `embed`. A spec passes when `embed` resolves, a
 * canvas is drawn with colored marks (not only titles and axes), and the page throws no error.
 * The Seattle and WHO specs load their data from GitHub, so the test needs a network connection.
 *
 * Chromium for Playwright is installed once with `npx playwright install chromium`.
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = path.join(root, 'package-dist');
const screenshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'time-i-gram-package-'));

if (!fs.existsSync(path.join(packageDir, 'dist/index.js'))) {
    console.error('package-dist/dist/index.js is missing: run `yarn build-package` first.');
    process.exit(1);
}

/** An exported spec of the editor examples, as JSON. */
async function exampleSpec(file, name) {
    const { outputFiles } = await esbuild.build({
        entryPoints: [path.join(root, 'editor/example/spec', file)],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'neutral'
    });
    const module = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
    return JSON.parse(JSON.stringify(module[name]));
}

/** ISO 8601 week strings, 2022-W40 to 2023-W26 (2022 has 52 weeks). */
function isoWeeksCsv() {
    const rows = ['week,cases'];
    const weeks = [
        ...Array.from({ length: 13 }, (_, i) => [2022, 40 + i]),
        ...Array.from({ length: 26 }, (_, i) => [2023, 1 + i])
    ];
    weeks.forEach(([year, week], i) =>
        rows.push(`${year}-W${String(week).padStart(2, '0')},${Math.round(50 + 40 * Math.sin(i / 5))}`)
    );
    return rows.join('\n');
}

const CASES = {
    // README, "Using the React Component"
    'seattle-weather': {
        title: 'Seattle Weather',
        tracks: [
            {
                data: {
                    url: 'https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv',
                    type: 'csv-time',
                    dateFields: ['date']
                },
                mark: 'bar',
                x: { field: 'date', type: 'temporal', axis: 'bottom', domain: { interval: [1325376000, 1451606400] } },
                y: { field: 'precipitation', type: 'quantitative' },
                width: 800,
                height: 200
            }
        ]
    },
    'who-flu-period': await exampleSpec('temporal-data_who-flu-period.ts', 'EX_SPEC_TEMPORAL_WHO_FLU_PERIOD'),
    'iso-week-strings': {
        title: 'ISO week strings',
        tracks: [
            {
                data: { url: '/fixtures/iso-weeks.csv', type: 'csv-time', dateFields: ['week'] },
                mark: 'bar',
                x: { field: 'week', type: 'temporal', axis: 'bottom', domain: { interval: ['2022-10', '2023-06'] } },
                y: { field: 'cases', type: 'quantitative', axis: 'left' },
                color: { value: 'steelblue' },
                width: 800,
                height: 200
            }
        ]
    }
};

const page = name => `<!DOCTYPE html>
<html>
<body style="margin: 0; background: white">
  <div id="vis"></div>
  <script type="module">
    import { embed } from '/dist/index.js';
    const spec = await (await fetch('/specs/${name}.json')).json();
    embed(document.getElementById('vis'), spec).then(
      () => (window.__embed = 'resolved'),
      error => (window.__embed = 'rejected: ' + (error && error.stack || error))
    );
  </script>
</body>
</html>`;

const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.csv': 'text/csv' };

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let body;
    if (url.pathname.startsWith('/specs/')) body = JSON.stringify(CASES[path.basename(url.pathname, '.json')]);
    else if (url.pathname === '/fixtures/iso-weeks.csv') body = isoWeeksCsv();
    else if (url.pathname.endsWith('.html')) body = page(path.basename(url.pathname, '.html'));
    else {
        const file = path.join(packageDir, path.normalize(url.pathname));
        if (file.startsWith(packageDir) && fs.existsSync(file) && fs.statSync(file).isFile())
            body = fs.readFileSync(file);
    }
    if (body === undefined) {
        res.writeHead(404).end();
        return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(url.pathname)] ?? 'application/octet-stream' }).end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

/** Pixels of a PNG with a saturated color (marks), as opposed to white, black and gray (background, text, axes). */
async function coloredPixels(browserPage, png) {
    return browserPage.evaluate(async base64 => {
        const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 40) count++;
        }
        return count;
    }, png.toString('base64'));
}

let browser;
try {
    browser = await chromium.launch();
} catch (error) {
    console.error(`${error.message}\nInstall Chromium for Playwright with \`npx playwright install chromium\`.`);
    server.close();
    process.exit(1);
}

let failed = 0;
for (const name of Object.keys(CASES)) {
    const browserPage = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
    const errors = [];
    browserPage.on('pageerror', error => errors.push(`page error: ${error.message}`));
    browserPage.on('console', message => {
        if (message.type() === 'error' || /could not parse/i.test(message.text())) {
            errors.push(`console ${message.type()}: ${message.text()}`);
        }
    });
    browserPage.on('requestfailed', request => errors.push(`request failed: ${request.url()}`));

    const problems = [];
    try {
        await browserPage.goto(`${origin}/${name}.html`);
        await browserPage.waitForFunction(() => window.__embed !== undefined, null, { timeout: 30000 });
        const status = await browserPage.evaluate(() => window.__embed);
        if (status !== 'resolved') problems.push(`embed ${status}`);
        await browserPage.waitForSelector('#vis canvas', { timeout: 15000 });
        await browserPage.waitForLoadState('networkidle');
        await browserPage.waitForTimeout(2000); // let tiles render
        const png = await browserPage.locator('#vis').screenshot({ path: path.join(screenshotDir, `${name}.png`) });
        const colored = await coloredPixels(browserPage, png);
        if (colored < 500) problems.push(`no marks drawn (${colored} colored pixels)`);
        else console.log(`  ${name}: ${colored} colored pixels`);
    } catch (error) {
        problems.push(error.message.split('\n')[0]);
    }
    problems.push(...errors);
    console.log(`${problems.length ? 'FAIL' : 'PASS'} ${name}`);
    problems.forEach(problem => console.log(`  ${problem}`));
    failed += problems.length ? 1 : 0;
    await browserPage.close();
}

await browser.close();
server.close();
console.log(`\nScreenshots: ${screenshotDir}`);
console.log(
    failed ? `${failed} of ${Object.keys(CASES).length} specs failed` : `All ${Object.keys(CASES).length} specs passed`
);
process.exit(failed ? 1 : 0);
