import { alias } from '../vite.config.js';

/** Mirrors how Vite matches an alias entry: a string matches itself and its sub-paths. */
function matches(find: string | RegExp, id: string) {
    return typeof find === 'string' ? id === find || id.startsWith(`${find}/`) : find.test(id);
}

describe('vite aliases', () => {
    it('resolve bare `uuid` to the ESM browser build', () => {
        const entry = alias.find(a => matches(a.find, 'uuid'));
        expect(entry?.replacement).toMatch(/uuid\/dist\/esm-browser\/index\.js$/);
    });

    it('do not capture `uuid/v4` (required by higlass-text)', () => {
        expect(alias.filter(a => matches(a.find, 'uuid/v4'))).toEqual([]);
    });
});

describe('imports of the Gosling schema module', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const src = path.resolve(__dirname, '../src');
    /** Inherited from upstream Gosling; left as they are. */
    const INHERITED = ['compiler/gosling-to-higlass.ts'];

    const files = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return entry.name === 'gosling-schema' ? [] : files(full);
            return /\.tsx?$/.test(entry.name) ? [full] : [];
        });

    it('go through the `@gosling-lang/gosling-schema` alias, not a relative path (one module instance)', () => {
        const relative = files(src)
            .filter(file => !INHERITED.includes(path.relative(src, file)))
            .filter(file => /from '(\.\.\/)+gosling-schema[/']/.test(fs.readFileSync(file, 'utf8')))
            .map(file => path.relative(src, file));
        expect(relative).toEqual([]);
    });
});
