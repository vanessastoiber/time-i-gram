import JsonTimeDataFetcher from './json-time-data-fetcher';

/** Seconds of a UTC date, e.g. utc(2012, 1, 31). */
const utc = (y: number, m: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, m - 1, d, h, mi, s) / 1000;

/** Create a `json-time` fetcher over inline values and return its parsed rows. */
async function loadValues(values: Record<string, unknown>[], config: Record<string, unknown> = {}) {
    const fetcher = new (JsonTimeDataFetcher as any)({}, { type: 'json-time', values, ...config });
    await new Promise(resolve => fetcher.tilesetInfo(resolve));
    return { fetcher, rows: fetcher.values as Record<string, any>[] };
}

describe('json-time data fetcher: date parsing', () => {
    it('parses a single date column', async () => {
        const { rows } = await loadValues(
            [{ date: '2000-03-01T08:00:00.000Z' }, { date: '2012-01-31' }, { date: '2012' }],
            { dateFields: ['date'] }
        );
        expect(rows.map(r => r.date)).toEqual([utc(2000, 3, 1, 8), utc(2012, 1, 31), utc(2012, 1, 1)]);
    });

    it('reads Unix timestamps from timestampField and keeps rows loaded from a url', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => ({ ok: true, json: async () => [{ t: '1327968000' }, { t: 1328054400 }] })) as any;
        try {
            const fetcher = new (JsonTimeDataFetcher as any)({}, { type: 'json-time', url: 'test.json', timestampField: 't' });
            await new Promise(resolve => fetcher.tilesetInfo(resolve));
            expect(fetcher.values.map((r: any) => r.t)).toEqual([utc(2012, 1, 31), utc(2012, 2, 1)]);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('builds dates from year/month/day columns in UTC', async () => {
        const { rows } = await loadValues([{ year: 2000, month: 3 }], { dateFields: ['year', 'month'] });
        expect(rows[0].year).toEqual(utc(2000, 3, 1));
    });
});
