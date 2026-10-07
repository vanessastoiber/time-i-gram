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
