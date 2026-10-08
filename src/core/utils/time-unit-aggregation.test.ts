import { binByTimeUnit, truncateTime } from './data-transform';
import {
    ABSOLUTE_TIME,
    filterByTimeUnits,
    isRowInTile,
    periodCoordinates,
    type TimeUnitBinning
} from './time-coordinate-system';
import CSVTimeDataFetcher from '../../data-fetchers/csv/csv-time-data-fetcher';
import { TIME_MAX_POS, TIME_MIN_POS } from '../../data-fetchers/time-utils';

const utc = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m - 1, d, h) / 1000;
const iso = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

const MONTHLY: TimeUnitBinning = {
    unit: 'month',
    source: 'date',
    field: '__month_date',
    endField: '__month_date_end',
    groupby: ['series'],
    aggregates: [{ field: 'v', op: 'sum' }]
};

describe('timeUnit transform', () => {
    it('truncates a field in place or into new fields, keeping every row', () => {
        const rows = [{ date: utc(2010, 8, 18, 13) }, { date: utc(1969, 12, 31, 12) }];
        expect(truncateTime({ type: 'timeUnit', field: 'date', unit: 'month' }, rows).map(r => iso(+r.date))).toEqual([
            '2010-08-01',
            '1969-12-01'
        ]);
        const weeks = truncateTime({ type: 'timeUnit', field: 'date', unit: 'week', newField: 'w', endField: 'we' }, rows);
        expect(weeks.map(r => [iso(+r.w), iso(+r.we)])).toEqual([
            ['2010-08-16', '2010-08-23'],
            ['1969-12-29', '1970-01-05']
        ]);
        expect(weeks[0].date).toEqual(utc(2010, 8, 18, 13));
    });
});

describe('binByTimeUnit', () => {
    const rows = [
        { date: utc(2010, 1, 5), series: 'A', v: 1 },
        { date: utc(2010, 1, 20), series: 'A', v: 2 },
        { date: utc(2010, 1, 31, 23), series: 'B', v: 10 },
        { date: utc(2010, 2, 1), series: 'A', v: 4 },
        { date: NaN, series: 'A', v: 100 }
    ];

    it('aggregates by unit and by the nominal fields', () => {
        const out = binByTimeUnit(MONTHLY, rows, ABSOLUTE_TIME);
        expect(out.map(r => [iso(+r.__month_date), iso(+r.__month_date_end), r.series, r.v])).toEqual([
            ['2010-01-01', '2010-02-01', 'A', 3],
            ['2010-01-01', '2010-02-01', 'B', 10],
            ['2010-02-01', '2010-03-01', 'A', 4]
        ]);
    });

    it.each([
        ['count', [2, 1, 1]],
        ['mean', [1.5, 10, 4]],
        ['median', [1.5, 10, 4]],
        ['min', [1, 10, 4]],
        ['max', [2, 10, 4]]
    ] as const)('computes %s', (op, expected) => {
        const out = binByTimeUnit({ ...MONTHLY, aggregates: [{ field: 'v', op }] }, rows, ABSOLUTE_TIME);
        expect(out.map(r => r.v)).toEqual(expected);
    });

    it('only places rows when nothing is aggregated', () => {
        const out = binByTimeUnit({ ...MONTHLY, aggregates: [] }, rows, ABSOLUTE_TIME);
        expect(out).toHaveLength(4);
        expect(out[1].v).toEqual(2);
    });

    it('uses ISO weeks across year boundaries', () => {
        const out = binByTimeUnit(
            { ...MONTHLY, unit: 'week', groupby: [] },
            [{ date: utc(2015, 12, 31), v: 1 }, { date: utc(2016, 1, 3), v: 2 }, { date: utc(2016, 1, 4), v: 4 }],
            ABSOLUTE_TIME
        );
        expect(out.map(r => [iso(+r.__month_date), r.v])).toEqual([
            ['2015-12-28', 3],
            ['2016-01-04', 4]
        ]);
    });

    it('places units within a period (monthly sums per year on a year ring)', () => {
        const year = periodCoordinates('year');
        const out = binByTimeUnit(
            { ...MONTHLY, groupby: ['year'] },
            [
                { date: utc(2011, 3, 2), year: '2011', v: 1 },
                { date: utc(2011, 3, 30), year: '2011', v: 2 },
                { date: utc(2012, 3, 15), year: '2012', v: 5 }
            ],
            year
        );
        expect(out.map(r => [iso(+r.__month_date), iso(+r.__month_date_end), r.year, r.v])).toEqual([
            ['2000-03-01', '2000-04-01', '2011', 3],
            ['2000-03-01', '2000-04-01', '2012', 5]
        ]);
    });

    it('ends the last unit of a period at the end of the reference period', () => {
        const year = periodCoordinates('year');
        const [row] = binByTimeUnit({ ...MONTHLY, groupby: [] }, [{ date: utc(2011, 12, 24), v: 1 }], year);
        expect(new Date(+row.__month_date_end * 1000).toISOString()).toEqual('2001-01-01T00:00:00.000Z');
    });
});

/** Daily rows from `start` for `days` days, each with value 1. */
const daily = (start: number, days: number) => Array.from({ length: days }, (_, i) => ({ date: start + i * 86400, v: 1 }));

describe('tile-exact aggregation', () => {
    const tiling = { source: 'date', units: ['month' as const], raw: false };

    it('assigns each unit to exactly one tile, so per-tile results equal the result over all rows', () => {
        const rows = daily(utc(2010, 1, 1), 120);
        const boundary = utc(2010, 2, 14, 7); // a tile edge in the middle of February
        const tiles: [number, number][] = [
            [utc(2009, 12, 1), boundary],
            [boundary, utc(2010, 6, 1)]
        ];
        const perTile = tiles.flatMap(tile => {
            const inTile = filterByTimeUnits(rows, tile, { x: 'date', timeUnitTiling: tiling });
            return binByTimeUnit({ ...MONTHLY, groupby: [] }, inTile, ABSOLUTE_TIME);
        });
        const all = binByTimeUnit({ ...MONTHLY, groupby: [] }, rows, ABSOLUTE_TIME);
        expect(perTile.map(r => [iso(+r.__month_date), r.v])).toEqual(all.map(r => [iso(+r.__month_date), r.v]));
        expect(perTile.find(r => iso(+r.__month_date) === '2010-02-01')?.v).toEqual(28);
    });

    it('serves overlaid tracks with different units (and raw rows) from the same tiles', () => {
        const rows = daily(utc(2010, 1, 1), 120);
        const tile: [number, number] = [utc(2010, 2, 14, 7), utc(2010, 6, 1)];
        const mixed = filterByTimeUnits(rows, tile, {
            x: 'date',
            timeUnitTiling: { source: 'date', units: ['month', 'week'], raw: true }
        });
        // February starts before the tile edge, so its monthly unit belongs to the previous tile; the raw rows
        // of February after the edge belong to this tile
        const monthly = mixed.filter(r => isRowInTile(r, tile, 'month', 'date', 'date', ABSOLUTE_TIME));
        const raw = mixed.filter(r => isRowInTile(r, tile, undefined, 'date', 'date', ABSOLUTE_TIME));
        expect(iso(Math.min(...monthly.map(r => r.date)))).toEqual('2010-03-01');
        expect(iso(Math.min(...raw.map(r => r.date)))).toEqual('2010-02-15');
    });

    it('works through the csv-time fetcher with real HiGlass tiles', async () => {
        // a zoom level whose tiles are about a year wide; pick the tile edge that falls in 2010
        const z = 13;
        const width = (TIME_MAX_POS - TIME_MIN_POS) / 2 ** z;
        const k = Math.floor((utc(2010, 6, 1) - TIME_MIN_POS) / width);
        const edge = TIME_MIN_POS + (k + 1) * width;
        const csv = 'date,v\n' + daily(edge - 60 * 86400, 120).map(r => `${new Date(r.date * 1000).toISOString()},1`).join('\n');

        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => ({ ok: true, text: async () => csv })) as any;
        const fetcher = new (CSVTimeDataFetcher as any)(
            {},
            { type: 'csv-time', url: 'test.csv', dateFields: ['date'], x: 'date', timeUnitTiling: tiling }
        );
        await new Promise(resolve => fetcher.tilesetInfo(resolve));
        globalThis.fetch = originalFetch;

        const ids = [`${z}.${k}`, `${z}.${k + 1}`];
        const tiles = await new Promise<any>(resolve => fetcher.fetchTilesDebounced(resolve, ids));
        const perTile = ids.flatMap((id, i) => {
            const bounds: [number, number] = [TIME_MIN_POS + (k + i) * width, TIME_MIN_POS + (k + i + 1) * width];
            const rows = tiles[id].tabularData.filter((r: any) => isRowInTile(r, bounds, 'month', 'date', 'date', ABSOLUTE_TIME));
            return binByTimeUnit({ ...MONTHLY, groupby: [] }, rows, ABSOLUTE_TIME);
        });
        const all = binByTimeUnit({ ...MONTHLY, groupby: [] }, fetcher.values, ABSOLUTE_TIME);
        expect(perTile.map(r => [r.__month_date, r.v])).toEqual(all.map(r => [r.__month_date, r.v]));
        // without the unit-aware tiles, the month of the edge would be split in two partial sums
        const naive = ids.flatMap((_, i) => {
            const bounds = [TIME_MIN_POS + (k + i) * width, TIME_MIN_POS + (k + i + 1) * width];
            const rows = fetcher.values.filter((r: any) => bounds[0] < r.date && r.date <= bounds[1]);
            return binByTimeUnit({ ...MONTHLY, groupby: [] }, rows, ABSOLUTE_TIME);
        });
        expect(naive.length).toBeGreaterThan(all.length);
    });
});
