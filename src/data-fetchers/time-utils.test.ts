import { rowsOfTile } from './time-utils';

describe('rows of a tile in the time data fetchers', () => {
    const day = 86400;
    const rows = [{ t: 10 * day }, { t: 40 * day }, { t: 70 * day }];

    it('select rows by their x field without time units', () => {
        expect(rowsOfTile(rows, [0, 50 * day], { x: 't' })).toEqual([{ t: 10 * day }, { t: 40 * day }]);
    });

    it('select rows by the start of their unit with time units', () => {
        // 1970-02-10 belongs to February, which starts after the tile's end
        const config = { x: 't', timeUnitTiling: { source: 't', units: ['month' as const], raw: false } };
        expect(rowsOfTile(rows, [-1, 31 * day - 1], config)).toEqual([{ t: 10 * day }]);
        expect(rowsOfTile(rows, [31 * day - 1, 59 * day - 1], config)).toEqual([{ t: 40 * day }]);
    });
});
