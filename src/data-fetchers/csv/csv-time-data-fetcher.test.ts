import CSVTimeDataFetcher from './csv-time-data-fetcher';

/** Seconds of a UTC date, e.g. utc(2012, 1, 31). */
const utc = (y: number, m: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, m - 1, d, h, mi, s) / 1000;

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

    it('warns once and does not place unparseable dates at 1970', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { rows } = await loadCsv('date\nnot a date\n2012-02-30', { dateFields: ['date'] });
        expect(rows.map(r => r.date)).toEqual([NaN, NaN]);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('not a date');
        warn.mockRestore();
    });
});
