#!/usr/bin/env node
// Script: generate-thumbnails.js
// Usage: run a dev server (yarn start) at http://localhost:3000 then run this script
// This script visits the editor with ?example=<id>&full=true and screenshots the preview area.

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Config
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'editor', 'example', 'thumbnails_generated');
const EXAMPLES_MODULE = path.resolve(__dirname, '..', 'editor', 'example', 'index.ts');

async function loadExampleIds() {
    // Parse example ids from the example module: find all top-level keys in any object literal block
    // that contains known example properties like `group:` or `name:`
    const content = fs.readFileSync(EXAMPLES_MODULE, 'utf8');

    // Find all object blocks that look like example registries:
    // match patterns like:  SOME_KEY: {\n    group: ...
    const ids = [];
    // Match identifiers or quoted keys that are followed by ': {' and whose body has 'group:'
    // We scan for blocks like `KEY: {` and grab KEY if the next few lines contain `group:`
    const blockRegex = /^\s{4}(["']?([A-Za-z0-9_]+)["']?)\s*:\s*\{/gm;
    let m;
    while ((m = blockRegex.exec(content)) !== null) {
        const id = m[2];
        // look ahead a bit to confirm it's an example (has `group:`)
        const ahead = content.slice(m.index, m.index + 400);
        if (ahead.includes('group:') && ahead.includes('name:')) {
            ids.push(id);
        }
    }
    return ids;
}

(async () => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const exampleIds = await loadExampleIds();
    if (!exampleIds || exampleIds.length === 0) {
        console.error('No examples found. Please ensure editor/example/index.ts contains an exported `examples` object.');
        process.exit(1);
    }

    console.log(`Found ${exampleIds.length} examples. Launching headless browser...`);
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    // Set viewport large enough for good quality thumbnails
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

    for (const id of exampleIds) {
        const url = `${BASE_URL}/?example=${encodeURIComponent(id)}&full=true`;
        console.log(`Loading ${id} -> ${url}`);
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            // Wait for the gosling component root to appear
            await page.waitForSelector('#goslig-component-root', { timeout: 30000 });

            // small wait to ensure rendering finished
            await new Promise(r => setTimeout(r, 2000));

            // screenshot preview-container if available, otherwise component root
            const preview = await page.$('#preview-container');
            const target = preview || (await page.$('#goslig-component-root'));
            if (!target) {
                console.warn(`Could not find preview element for ${id}, skipping.`);
                continue;
            }

            const clip = await target.boundingBox();
            if (!clip) {
                console.warn(`Could not get bounding box for ${id}, skipping.`);
                continue;
            }

            const outPath = path.join(OUTPUT_DIR, `${id}.png`);
            await page.screenshot({ path: outPath, clip, omitBackground: false });
            console.log(`Saved ${outPath}`);
        } catch (e) {
            console.error(`Failed to capture ${id}:`, e.message || e);
        }
    }

    await browser.close();
    console.log('Done.');
})();
