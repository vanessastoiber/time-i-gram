/**
 * Render-level regression test for interactive genomic examples: this branch must draw them exactly as the
 * reference branch does, at load and after zooming and panning.
 *
 * Usage (two editor dev servers, e.g. this branch and a worktree of the reference branch):
 *   npx vite --mode editor --port 3456 --strictPort            # this branch
 *   (in the worktree) npx vite --mode editor --port 3457 --strictPort
 *   node scripts/render-regression.cjs [--head URL] [--base URL] [--samples n] [--out dir]
 *
 * Needs `playwright`, `pixelmatch` (5.x) and `pngjs`, which are not dependencies of the repository: install them
 * in a scratch folder and run with `NODE_PATH=<scratch>/node_modules`. Exits with 1 if a case differs from the
 * reference: the head render must match one of `--samples` reference renders (default 4) within 0.05% of the pixels.
 * (The reference itself can vary between runs after interaction; its spread is printed for information.)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const args = Object.fromEntries(
    process.argv
        .slice(2)
        .reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), [])
);
const HEAD = args.head ?? 'http://localhost:3456';
const BASE = args.base ?? 'http://localhost:3457';
const OUT = args.out;
const MARGIN = 0.0005; // 0.05% of the pixels
const SAMPLES = Number(args.samples ?? 4); // reference renders per case

/** Interactions as in the review (docs/review-temporal-grammar.md, S3). */
const CASES = [
    { id: 'MARK_DISPLACEMENT', name: 'load', steps: [] },
    { id: 'MARK_DISPLACEMENT', name: 'zoom', steps: [{ wheel: [600, 350, -200, 4] }] },
    {
        id: 'MARK_DISPLACEMENT',
        name: 'zoom+pan',
        steps: [{ wheel: [600, 350, -200, 4] }, { drag: [600, 350, 450, 350] }]
    }
];

async function shot(browser, url, { id, steps }) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 950 } });
    await page.goto(`${url}/?example=${id}&full=true`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForTimeout(6000);
    for (const step of steps) {
        if (step.wheel) {
            const [x, y, delta, n] = step.wheel;
            await page.mouse.move(x, y);
            for (let i = 0; i < n; i++) {
                await page.mouse.wheel(0, delta);
                await page.waitForTimeout(150);
            }
        }
        if (step.drag) {
            const [x0, y0, x1, y1] = step.drag;
            await page.mouse.move(x0, y0);
            await page.mouse.down();
            await page.mouse.move(x1, y1, { steps: 10 });
            await page.mouse.up();
        }
        await page.waitForTimeout(8000);
    }
    const png = PNG.sync.read(await page.screenshot());
    await page.close();
    return png;
}

/** Share of non-white pixels: a blank page (e.g. a dev server still optimizing dependencies) proves nothing. */
function inkShare(png) {
    let ink = 0;
    for (let i = 0; i < png.data.length; i += 4) {
        if (png.data[i] < 230 || png.data[i + 1] < 230 || png.data[i + 2] < 230) ink++;
    }
    return ink / (png.width * png.height);
}

function difference(a, b) {
    const out = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0.1 });
    return { share: n / (a.width * a.height), image: out };
}

(async () => {
    const browser = await chromium.launch();
    let failed = 0;
    for (const c of CASES) {
        // the reference is not always deterministic after interaction, so take several reference renders
        const bases = [];
        for (let i = 0; i < SAMPLES; i++) bases.push(await shot(browser, BASE, c));
        const head = await shot(browser, HEAD, c);
        let noise = 0;
        bases.forEach((a, i) => bases.slice(i + 1).forEach(b => (noise = Math.max(noise, difference(a, b).share))));
        const changes = bases.map(b => difference(b, head));
        const closest = changes.reduce((best, d) => (d.share < best.share ? d : best));
        const blank = [...bases, head].some(png => inkShare(png) < 0.02);
        const ok = !blank && closest.share <= MARGIN;
        if (!ok) failed++;
        if (OUT) {
            fs.mkdirSync(OUT, { recursive: true });
            const file = `${c.id}-${c.name.replace(/\W/g, '-')}`;
            fs.writeFileSync(path.join(OUT, `${file}-base.png`), PNG.sync.write(bases[changes.indexOf(closest)]));
            fs.writeFileSync(path.join(OUT, `${file}-head.png`), PNG.sync.write(head));
            fs.writeFileSync(path.join(OUT, `${file}-diff.png`), PNG.sync.write(closest.image));
        }
        const pct = v => `${(v * 100).toFixed(3)}%`;
        console.log(
            `${ok ? 'ok  ' : 'FAIL'} ${c.id} ${c.name}: reference spread ${pct(noise)}, ` +
                `head vs closest reference ${pct(closest.share)}` +
                (blank ? ' (a render is blank)' : '')
        );
    }
    await browser.close();
    process.exit(failed ? 1 : 0);
})();
