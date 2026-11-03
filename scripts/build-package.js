/**
 * Writes the npm package of time-i-gram to `package-dist/` (run by `yarn build-package`, after `yarn build-lib`).
 *
 * - dist/index.js: one self-contained ES module built from `embed/index.ts`, with React, ReactDOM, PixiJS,
 *   HiGlass and their CSS inlined, so it runs from a CDN or a bundler without installing anything else.
 * - dist/index.d.ts and dist/gosling.schema.d.ts: types of `embed` and of the spec (`GoslingSpec`).
 * - package.json, README.md and LICENSE from `npm-package/`. The name and version are set there.
 *
 * Publish with `npm publish` inside `package-dist/`.
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const template = path.join(root, 'npm-package');
const out = path.join(root, 'package-dist');

function injectCss(code) {
    return `
function __injectStyle(css) {
  const headEl = document.head || document.getElementsByTagName('head')[0];
  const styleEl = document.createElement('style');
  styleEl.type = 'text/css';
  styleEl.appendChild(document.createTextNode(css));
  headEl.appendChild(styleEl);
}
__injectStyle(${JSON.stringify(code)});
`;
}

async function main() {
    const lib = path.join(root, 'dist/gosling.es.js');
    if (!fs.existsSync(lib)) throw new Error('dist/gosling.es.js is missing: run `yarn build-lib` first.');

    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(path.join(out, 'dist'), { recursive: true });

    // Same settings as scripts/build-embed.js, but without code splitting: one file that a CDN serves as is.
    const result = await esbuild.build({
        entryPoints: [path.join(root, 'embed/index.ts')],
        outfile: path.join(out, 'dist/index.js'),
        target: 'es2018',
        format: 'esm',
        bundle: true,
        minify: true,
        metafile: true,
        logLevel: 'warning',
        inject: [path.join(root, 'src/alias/buffer-shim.js')],
        define: { 'process.env.NODE_ENV': '"production"' },
        plugins: [
            {
                name: 'inject-css',
                setup(build) {
                    build.onLoad({ filter: /\.css$/ }, async args => {
                        const css = await fs.promises.readFile(args.path, 'utf-8');
                        return { contents: injectCss(css), loader: 'js' };
                    });
                }
            },
            {
                name: 'resolve-gosling',
                setup(build) {
                    // `embed/index.ts` imports `gosling.js`: use the library just built
                    build.onResolve({ filter: /^gosling\.js$/ }, () => ({ path: lib }));
                }
            }
        ]
    });
    const outputs = Object.keys(result.metafile.outputs);
    const imports = Object.values(result.metafile.outputs).flatMap(o => o.imports);
    if (outputs.length !== 1 || imports.length > 0) {
        throw new Error(`dist/index.js is not self-contained: outputs ${outputs}, imports ${JSON.stringify(imports)}`);
    }

    // Types: the spec types are self-contained in gosling.schema.ts
    execFileSync(
        path.join(root, 'node_modules/.bin/tsc'),
        [
            path.join(root, 'src/gosling-schema/gosling.schema.ts'),
            '--declaration',
            '--emitDeclarationOnly',
            '--skipLibCheck',
            '--target',
            'es2018',
            '--outDir',
            path.join(out, 'dist')
        ],
        { stdio: 'inherit' }
    );
    fs.copyFileSync(path.join(template, 'index.d.ts'), path.join(out, 'dist/index.d.ts'));

    for (const file of ['package.json', 'README.md', 'LICENSE']) {
        fs.copyFileSync(path.join(template, file), path.join(out, file));
    }

    const { name, version } = require(path.join(out, 'package.json'));
    const size = fs.statSync(path.join(out, 'dist/index.js')).size;
    console.log(`${name}@${version} written to package-dist/ (dist/index.js: ${(size / 1e6).toFixed(1)} MB)`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
