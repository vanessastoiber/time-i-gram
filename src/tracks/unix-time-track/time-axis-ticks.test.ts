import { timeAxisTicks } from './time-axis-ticks';
import { periodCoordinates, periodReference } from '../../core/utils/time-coordinate-system';

const s = (iso: string) => Date.parse(`${iso}Z`) / 1000;

describe('time axis ticks', () => {
    it('label absolute time with dates and a context', () => {
        const { labels, context } = timeAxisTicks([s('2010-01-01T00:00:00'), s('2011-01-01T00:00:00')]);
        expect(labels).toContain('Mar');
        expect(context).toEqual('2010');
    });

    it('label a year period by month, without years', () => {
        const year = periodCoordinates('year');
        const { labels, context } = timeAxisTicks(periodReference(year), year);
        expect(labels).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
        expect(labels.join(' ')).not.toMatch(/2000|2001/);
        expect(context).toEqual('');
    });

    it('label a season starting in August from Aug to Jul', () => {
        const season = periodCoordinates({ unit: 'year', start: 8 });
        const { labels } = timeAxisTicks(periodReference(season), season);
        expect(labels[0]).toEqual('Aug');
        expect(labels[labels.length - 1]).toEqual('Jul');
    });

    it('label week-based years by ISO week, starting at the start week', () => {
        const iso = periodCoordinates({ unit: 'year', weekBased: true });
        expect(timeAxisTicks(periodReference(iso), iso).labels.slice(0, 3)).toEqual(['W1', 'W9', 'W17']);
        const flu = periodCoordinates({ unit: 'year', weekBased: true, start: 40 });
        const labels = timeAxisTicks(periodReference(flu), flu).labels;
        expect(labels.slice(0, 4)).toEqual(['W41', 'W49', 'W1', 'W9']);
    });

    it('label weeks at their start and weekdays otherwise when zoomed into a few weeks of a week-based year', () => {
        const iso = periodCoordinates({ unit: 'year', weekBased: true });
        const [start] = periodReference(iso);
        const { labels } = timeAxisTicks([start, start + 14 * 86400], iso);
        expect(labels[0]).toEqual('W1');
        expect(labels).toContain('W2');
        expect(labels).toContain('Wed');
    });

    it('label weeks by weekday and days by time of day', () => {
        const week = periodCoordinates('week');
        expect(timeAxisTicks(periodReference(week), week).labels.slice(0, 2)).toEqual(['Mon', 'Mon 12:00']);
        const day = periodCoordinates('day');
        expect(timeAxisTicks(periodReference(day), day).labels.slice(0, 3)).toEqual(['00:00', '03:00', '06:00']);
        const month = periodCoordinates('month');
        expect(timeAxisTicks(periodReference(month), month).labels.slice(0, 2)).toEqual(['1', '3']);
    });
});

describe('relative time axis ticks', () => {
    const WEEK = 7 * 86400;

    it('label signed offsets in the chosen unit, with a context naming the anchor', () => {
        const { ticks, labels, context } = timeAxisTicks([-4 * WEEK, 10 * WEEK], {
            kind: 'relative',
            unit: 'week',
            anchorLabel: 'the maximum of INF_A'
        });
        expect(labels).toContain('0');
        expect(labels).toContain('−2 wk');
        expect(labels).toContain('+4 wk');
        expect(ticks[labels.indexOf('0')]).toEqual(0);
        expect(context).toEqual('weeks from the maximum of INF_A');
    });

    it('choose a unit from the visible span when none is given', () => {
        expect(timeAxisTicks([-3 * 86400, 3 * 86400], { kind: 'relative' }).labels).toContain('+1 d');
        expect(timeAxisTicks([-3 * 365.2425 * 86400, 2 * 365.2425 * 86400], { kind: 'relative' }).labels).toContain(
            '+1 y'
        );
    });
});

describe('period axes zoomed out past the period', () => {
    it('label only positions inside the reference period, before and after it alike', () => {
        const DAY = 86400;
        [
            periodCoordinates('day'),
            periodCoordinates('year'),
            periodCoordinates({ unit: 'year', weekBased: true })
        ].forEach(cs => {
            const [refStart, refEnd] = periodReference(cs);
            const length = refEnd - refStart;
            const { ticks, labels } = timeAxisTicks([refStart - 2 * length - DAY, refEnd + 2 * length], cs);
            expect(ticks.length).toBeGreaterThan(0);
            expect(ticks.every(t => refStart <= t && t < refEnd)).toBe(true);
            expect(labels.length).toEqual(ticks.length);
        });
    });
});

describe('week-based seasons', () => {
    it('label week 1 right after week 52, with the spare week-53 slot at the end of the season', () => {
        const flu = periodCoordinates({ unit: 'year', weekBased: true, start: 40 });
        const [refStart] = periodReference(flu);
        const WEEK = 7 * 86400;
        const { ticks, labels } = timeAxisTicks([refStart, refStart + 53 * WEEK], flu, 60);
        const at = (offset: number) => labels[ticks.indexOf(refStart + offset * WEEK)];
        expect(at(0)).toEqual('W40');
        expect(at(12)).toEqual('W52');
        expect(at(13)).toEqual('W1');
        expect(at(51)).toEqual('W39');
        expect(ticks.indexOf(refStart + 52 * WEEK)).toEqual(-1);
    });
});

describe('tick count from the axis width', () => {
    const DAY = 86400;
    const CHAR = 7; // px per character at the axis font size
    /** Whether neighboring labels, centered on their ticks, leave at least `gap` px between them. */
    const fits = (
        { ticks, labels }: { ticks: number[]; labels: string[] },
        domain: [number, number],
        width: number,
        gap = 6
    ) =>
        ticks.every((t, i) => {
            if (i === 0) return true;
            const dx = ((t - ticks[i - 1]) / (domain[1] - domain[0])) * width;
            return dx >= ((labels[i].length + labels[i - 1].length) / 2) * CHAR + gap;
        });

    it('keeps relative labels apart on a narrow track (M7)', () => {
        const relative = { kind: 'relative' as const, unit: 'day' as const };
        const domain: [number, number] = [-3 * DAY, 3 * DAY];
        expect(fits(timeAxisTicks(domain, relative), domain, 380)).toBe(false); // ten ticks, as before
        const fitted = timeAxisTicks(domain, relative, 10, 380);
        expect(fitted.ticks.length).toBeGreaterThan(2);
        expect(fits(fitted, domain, 380)).toBe(true);
    });

    it('keeps week-based labels apart when zoomed in to a few weeks, with short labels (S4)', () => {
        const iso = periodCoordinates({ unit: 'year', weekBased: true });
        const [refStart] = periodReference(iso);
        const domain: [number, number] = [refStart + 25 * 7 * DAY, refStart + 29 * 7 * DAY];
        const fitted = timeAxisTicks(domain, iso, 10, 420);
        expect(fits(fitted, domain, 420)).toBe(true);
        expect(fitted.labels.every(l => l.length <= 5)).toBe(true); // "W27", "Tue", "12:00"
        expect(fitted.labels.some(l => /^W\d+$/.test(l))).toBe(true);
        // the context names the visible weeks
        expect(fitted.context).toEqual('W26\u2013W29');
        expect(timeAxisTicks([refStart + 25 * 7 * DAY, refStart + 25.5 * 7 * DAY], iso, 10, 420).context).toEqual(
            'W26'
        );
    });

    it('keeps absolute labels apart', () => {
        const domain: [number, number] = [Date.UTC(1918, 0, 1) / 1000, Date.UTC(1922, 0, 1) / 1000];
        expect(fits(timeAxisTicks(domain, undefined, 10, 380), domain, 380)).toBe(true);
    });
});

describe('context label of absolute axes (G5)', () => {
    const t = (iso: string) => Date.parse(`${iso}Z`) / 1000;

    it('names the visible range, not the date at the center', () => {
        // monthly ticks over two years: the years
        expect(timeAxisTicks([t('2021-06-15T00:00:00'), t('2022-03-01T00:00:00')]).context).toEqual('2021–2022');
        expect(timeAxisTicks([t('2022-02-01T00:00:00'), t('2022-11-01T00:00:00')]).context).toEqual('2022');
        // daily ticks: the months
        expect(timeAxisTicks([t('2022-05-10T00:00:00'), t('2022-07-20T00:00:00')], undefined, 30).context).toEqual(
            '2022 May–Jul'
        );
        expect(timeAxisTicks([t('2021-12-20T00:00:00'), t('2022-01-10T00:00:00')]).context).toEqual(
            '2021 Dec – 2022 Jan'
        );
        // hourly ticks: the day
        expect(timeAxisTicks([t('2016-02-03T06:00:00'), t('2016-02-03T18:00:00')]).context).toEqual('2016 Feb 3');
        expect(timeAxisTicks([t('2016-02-03T18:00:00'), t('2016-02-04T06:00:00')]).context).toEqual('2016 Feb 3–4');
    });
});

describe('absolute tick labels (M9)', () => {
    const t = (iso: string) => Date.parse(`${iso}Z`) / 1000;
    it('use 24-hour times and short month names', () => {
        const hour = timeAxisTicks([t('2016-02-03T12:35:00'), t('2016-02-03T13:35:00')]);
        expect(hour.labels).toContain('13:00');
        expect(hour.labels.join(' ')).not.toMatch(/PM|AM/);
        expect(hour.context).toEqual('2016 Feb 3, 12:35\u201313:35');
        const year = timeAxisTicks([t('2022-01-01T00:00:00'), t('2023-01-01T00:00:00')]);
        expect(year.labels.slice(0, 3)).toEqual(['2022', 'Feb', 'Mar']);
    });
});
