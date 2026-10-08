import { timeAxisTicks } from './time-axis-ticks';
import { periodCoordinates, periodReference } from '../../core/utils/time-coordinate-system';

const s = (iso: string) => Date.parse(`${iso}Z`) / 1000;

describe('time axis ticks', () => {
    it('label absolute time with dates and a context', () => {
        const { labels, context } = timeAxisTicks([s('2010-01-01T00:00:00'), s('2011-01-01T00:00:00')]);
        expect(labels).toContain('March');
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

    it('label weekdays when zoomed into a few weeks of a week-based year', () => {
        const iso = periodCoordinates({ unit: 'year', weekBased: true });
        const [start] = periodReference(iso);
        const { labels } = timeAxisTicks([start, start + 14 * 86400], iso);
        expect(labels[0]).toEqual('W1 Mon');
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
