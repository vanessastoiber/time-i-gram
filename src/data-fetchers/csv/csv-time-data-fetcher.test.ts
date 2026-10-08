import CSVTimeDataFetcher from './csv-time-data-fetcher';

/** Seconds of a UTC date, e.g. utc(2012, 1, 31). */
const utc = (y: number, m: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, m - 1, d, h, mi, s) / 1000;

/** ISO date of the i-th day after 2000-01-01. */
const formatDay = (i: number) => new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10);

/** Create a `csv-time` fetcher over in-memory CSV text and return its parsed rows. */
async function loadCsv(csv: string, config: Record<string, unknown> = {}) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({ ok: true, text: async () => csv })) as any;
    try {
        const fetcher = new (CSVTimeDataFetcher as any)({}, { type: 'csv-time', url: 'test.csv', ...config });
        await new Promise(resolve => fetcher.tilesetInfo(resolve));
        return { fetcher, rows: fetcher.values as Record<string, any>[] };
    } finally {
        globalThis.fetch = originalFetch;
    }
}

describe('csv-time data fetcher: date parsing', () => {
    it('parses ISO, US and day-first dates without options', async () => {
        const { rows } = await loadCsv('date\n2012-01-31\n01/31/2012\n31.01.2012\n2012/01/31', {
            dateFields: ['date']
        });
        expect(rows.map(r => r.date)).toEqual([utc(2012, 1, 31), utc(2012, 1, 31), utc(2012, 1, 31), utc(2012, 1, 31)]);
    });

    it('uses dayFirstDate for ambiguous dates', async () => {
        const { rows } = await loadCsv('date\n01.02.2012', { dateFields: ['date'], dayFirstDate: true });
        expect(rows[0].date).toEqual(utc(2012, 2, 1));
    });

    it('parses dates before 1900 and puts dates before 1970 into tiles', async () => {
        const { fetcher, rows } = await loadCsv('date,v\n1066-10-14,1\n1850,2\n1969-12-31,3\n2012-01-31,4', {
            dateFields: ['date'],
            x: 'date'
        });
        expect(rows.map(r => r.date)).toEqual([utc(1066, 10, 14), utc(1850, 1, 1), utc(1969, 12, 31), utc(2012, 1, 31)]);
        const tile = await new Promise<any>(resolve => fetcher.fetchTilesDebounced(resolve, ['0.0']));
        expect(tile['0.0'].tabularData.map((r: any) => r.v)).toEqual(['1', '2', '3', '4']);
    });

    it('converts both columns of `interval` (dates and timestamps)', async () => {
        // `Date.parse` rejects both day-first dates in the first row.
        const { rows } = await loadCsv('start,end\n31.01.2012,15.02.2012\n1327968000,1328054400', {
            interval: ['start', 'end']
        });
        expect(rows.map(r => [r.start, r.end])).toEqual([
            [utc(2012, 1, 31), utc(2012, 2, 15)],
            [utc(2012, 1, 31), utc(2012, 2, 1)]
        ]);
    });

    describe('reads date-times without a zone as UTC, whatever the browser time zone', () => {
        const originalTz = process.env.TZ;
        beforeAll(() => {
            process.env.TZ = 'America/New_York';
        });
        afterAll(() => {
            process.env.TZ = originalTz;
        });

        it('single date-time columns', async () => {
            const { rows } = await loadCsv(
                't\n2016-02-29 16:40:21\n4/12/2016 7:21:00 AM\n4/12/2016 7:21:00 PM\n2010-01-03T23:00:00\n2022-01-01T00:00+01:00',
                { dateFields: ['t'] }
            );
            expect(rows.map(r => r.t)).toEqual([
                utc(2016, 2, 29, 16, 40, 21),
                utc(2016, 4, 12, 7, 21),
                utc(2016, 4, 12, 19, 21),
                utc(2010, 1, 3, 23),
                utc(2021, 12, 31, 23) // explicit zone is kept
            ]);
        });

        it('date and time-of-day columns', async () => {
            const { rows } = await loadCsv('d,t\n2016-02-29,16:40:21', { dateFields: ['d', 't'] });
            expect(rows[0].d).toEqual(utc(2016, 2, 29, 16, 40, 21));
        });

        it('year/month/day/hour component columns', async () => {
            const { rows } = await loadCsv('year,month,day,hour\n2016,2,29,16', {
                dateFields: ['year', 'month', 'day', 'hour']
            });
            expect(rows[0].year).toEqual(utc(2016, 2, 29, 16));
        });

        it('calendar weeks start at UTC midnight', async () => {
            const { rows } = await loadCsv('year,week\n2016,5', {
                dateFields: ['year', 'week'],
                includesCalendarWeek: true
            });
            expect(rows[0].year % 86400).toEqual(0);
        });
    });

    it('reads timestampField in seconds by default and in milliseconds with timestampUnit', async () => {
        const seconds = await loadCsv('t\n1327968000', { timestampField: 't' });
        expect(seconds.rows[0].t).toEqual(utc(2012, 1, 31));
        const millis = await loadCsv('t\n1327968000000', { timestampField: 't', timestampUnit: 'ms' });
        expect(millis.rows[0].t).toEqual(utc(2012, 1, 31));
    });

    it('keeps every row of a tile unless sampleLength is set', async () => {
        const csv = 'date\n' + Array.from({ length: 1500 }, (_, i) => formatDay(i)).join('\n');
        const all = await loadCsv(csv, { dateFields: ['date'], x: 'date' });
        const allTile = await new Promise<any>(resolve => all.fetcher.fetchTilesDebounced(resolve, ['0.0']));
        expect(allTile['0.0'].tabularData.length).toEqual(1500);

        const sampled = await loadCsv(csv, { dateFields: ['date'], x: 'date', sampleLength: 100 });
        const sampledTile = await new Promise<any>(resolve => sampled.fetcher.fetchTilesDebounced(resolve, ['0.0']));
        expect(sampledTile['0.0'].tabularData.length).toEqual(100);
    });

    it('warns once and does not place unparseable dates at 1970', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { rows } = await loadCsv('date\nnot a date\n2012-02-30', { dateFields: ['date'] });
        expect(rows.map(r => r.date)).toEqual([NaN, NaN]);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('not a date');
        warn.mockRestore();
    });
});
