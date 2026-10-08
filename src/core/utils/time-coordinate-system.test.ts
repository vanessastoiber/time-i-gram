import {
    applyTimeCoordinates,
    describeTimeCoordinates,
    periodCoordinates,
    periodEndOf,
    periodKey,
    periodKeyField,
    periodReference,
    periodStartOf,
    timeCoordinateSignature,
    toPeriodCoordinate
} from './time-coordinate-system';

/** Unix seconds of an ISO date or date-time (UTC). */
const s = (iso: string) => Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso) / 1000;
/** ISO string of a coordinate. */
const iso = (t: number) => new Date(t * 1000).toISOString();

const YEAR = periodCoordinates('year');
const ISO_YEAR = periodCoordinates({ unit: 'year', weekBased: true });

describe('period coordinate systems', () => {
    it('normalize the shorthand and the object form', () => {
        expect(YEAR).toEqual({ kind: 'period', unit: 'year', weekBased: false, start: 1 });
        expect(periodCoordinates({ unit: 'day' })).toEqual({ kind: 'period', unit: 'day', weekBased: false, start: 0 });
        // weekBased only applies to years
        expect(periodCoordinates({ unit: 'week', weekBased: true }).weekBased).toBe(false);
    });

    it('have signatures that distinguish every option', () => {
        const signatures = [
            YEAR,
            ISO_YEAR,
            periodCoordinates({ unit: 'year', start: 8 }),
            periodCoordinates('week'),
            { kind: 'absolute' as const }
        ].map(timeCoordinateSignature);
        expect(new Set(signatures).size).toEqual(signatures.length);
        expect(describeTimeCoordinates(periodCoordinates({ unit: 'year', weekBased: true, start: 40 }))).toEqual(
            'period (year, ISO weeks, start 40)'
        );
    });

    it('name the period field', () => {
        expect(periodKeyField('date', 'year')).toEqual('date_year');
        expect(periodKeyField('date', { unit: 'year', newField: 'season' })).toEqual('season');
    });
});

describe('calendar years', () => {
    it('align dates across years in a leap reference year', () => {
        expect(iso(toPeriodCoordinate(s('2013-03-01T06:00:00Z'), YEAR))).toEqual('2000-03-01T06:00:00.000Z');
        expect(toPeriodCoordinate(s('2012-03-01'), YEAR)).toEqual(toPeriodCoordinate(s('2013-03-01'), YEAR));
        expect(iso(toPeriodCoordinate(s('2012-02-29'), YEAR))).toEqual('2000-02-29T00:00:00.000Z');
        expect(periodReference(YEAR).map(iso)).toEqual(['2000-01-01T00:00:00.000Z', '2001-01-01T00:00:00.000Z']);
    });

    it('cover year boundaries and dates before 1970', () => {
        expect(iso(toPeriodCoordinate(s('1918-12-31T23:59:59Z'), YEAR))).toEqual('2000-12-31T23:59:59.000Z');
        expect(iso(toPeriodCoordinate(s('1919-01-01'), YEAR))).toEqual('2000-01-01T00:00:00.000Z');
        expect(periodKey(s('1918-12-31'), YEAR)).toEqual('1918');
        expect(periodKey(s('0800-06-01'), YEAR)).toEqual('0800');
    });

    it('can start in another month (seasons)', () => {
        const season = periodCoordinates({ unit: 'year', start: 8 });
        const [refStart, refEnd] = periodReference(season);
        expect([iso(refStart), iso(refEnd)]).toEqual(['1999-08-01T00:00:00.000Z', '2000-08-01T00:00:00.000Z']);
        expect(iso(toPeriodCoordinate(s('2010-08-01'), season))).toEqual('1999-08-01T00:00:00.000Z');
        expect(iso(toPeriodCoordinate(s('2011-02-29'.replace('29', '28')), season))).toEqual('2000-02-28T00:00:00.000Z');
        expect(iso(toPeriodCoordinate(s('2012-02-29'), season))).toEqual('2000-02-29T00:00:00.000Z');
        expect(periodKey(s('2011-07-31'), season)).toEqual('2010/11');
        expect(periodKey(s('2099-09-01'), season)).toEqual('2099/00');
        expect(iso(periodStartOf(s('2011-03-01'), season))).toEqual('2010-08-01T00:00:00.000Z');
    });
});

describe('week-based (ISO) years', () => {
    it('put ISO week 1 at the start, even when it begins in December', () => {
        const [refStart] = periodReference(ISO_YEAR);
        expect(toPeriodCoordinate(s('2013-12-30'), ISO_YEAR)).toEqual(refStart); // 2014-W01 Monday
        expect(toPeriodCoordinate(s('2010-01-04'), ISO_YEAR)).toEqual(refStart); // 2010-W01 Monday
        expect(periodKey(s('2013-12-30'), ISO_YEAR)).toEqual('2014');
    });

    it('place week 53 last and the following week 1 at the start again', () => {
        const [refStart, refEnd] = periodReference(ISO_YEAR);
        expect((refEnd - refStart) / (7 * 86400)).toEqual(53);
        const w53 = toPeriodCoordinate(s('2015-12-28'), ISO_YEAR); // 2015-W53 Monday
        expect((w53 - refStart) / (7 * 86400)).toEqual(52);
        expect(periodKey(s('2016-01-03'), ISO_YEAR)).toEqual('2015');
        expect(toPeriodCoordinate(s('2016-01-04'), ISO_YEAR)).toEqual(refStart);
    });

    it('can start at a week (flu seasons from week 40)', () => {
        const flu = periodCoordinates({ unit: 'year', weekBased: true, start: 40 });
        const [refStart] = periodReference(flu);
        const week = (t: number) => (toPeriodCoordinate(t, flu) - refStart) / (7 * 86400);
        expect(week(s('2010-10-04'))).toEqual(0); // 2010-W40
        expect(week(s('2011-01-03'))).toEqual(14); // 2011-W01, after a reserved week 53
        expect(week(s('2011-09-26'))).toEqual(52); // 2011-W39, the last week of the season
        expect(periodKey(s('2011-01-03'), flu)).toEqual('2010/11');
        expect(iso(periodEndOf(s('2011-01-03'), flu))).toEqual('2011-10-03T00:00:00.000Z');
    });
});

describe('months, weeks and days', () => {
    it('place a time by day of the month', () => {
        const month = periodCoordinates('month');
        expect(iso(toPeriodCoordinate(s('2010-02-15T12:00:00Z'), month))).toEqual('2000-01-15T12:00:00.000Z');
        expect(periodKey(s('2010-02-15'), month)).toEqual('2010-02');
    });

    it('place a time by weekday (Monday first, or a chosen weekday)', () => {
        const week = periodCoordinates('week');
        expect(iso(toPeriodCoordinate(s('2016-04-17T07:30:00Z'), week))).toEqual('2001-01-07T07:30:00.000Z'); // Sunday
        expect(periodKey(s('2016-04-17'), week)).toEqual('2016-W15');
        const sundayWeek = periodCoordinates({ unit: 'week', start: 7 });
        expect(toPeriodCoordinate(s('2016-04-17'), sundayWeek)).toEqual(periodReference(sundayWeek)[0]);
        expect(periodKey(s('2016-04-18'), sundayWeek)).toEqual('2016-04-17');
    });

    it('place a time by time of day, also with a shifted start', () => {
        const day = periodCoordinates('day');
        expect(iso(toPeriodCoordinate(s('1960-05-05T13:45:00Z'), day))).toEqual('2000-01-01T13:45:00.000Z');
        expect(periodKey(s('1960-05-05T13:45:00Z'), day)).toEqual('1960-05-05');
        const shifted = periodCoordinates({ unit: 'day', start: 6 });
        expect(iso(toPeriodCoordinate(s('2016-02-03T05:00:00Z'), shifted))).toEqual('2000-01-02T05:00:00.000Z');
        expect(periodKey(s('2016-02-03T05:00:00Z'), shifted)).toEqual('2016-02-02');
    });
});

describe('applyTimeCoordinates', () => {
    const config = {
        system: YEAR,
        fields: [
            { source: 'start', coord: '__period_start' },
            { source: 'end', coord: '__period_end' }
        ],
        keyFields: ['year'],
        interval: ['start', 'end'] as [string, string]
    };

    it('adds coordinates and period keys and keeps the source fields', () => {
        const [row] = applyTimeCoordinates([{ start: s('2013-05-01'), end: s('2013-05-02'), v: 3 }], config);
        expect(row).toMatchObject({ start: s('2013-05-01'), v: 3, year: '2013' });
        expect(iso(row.__period_start as number)).toEqual('2000-05-01T00:00:00.000Z');
        expect(iso(row.__period_end as number)).toEqual('2000-05-02T00:00:00.000Z');
    });

    it('splits an interval that crosses the year boundary', () => {
        const rows = applyTimeCoordinates([{ start: s('2012-12-20'), end: s('2013-01-10') }], config);
        expect(rows.map(r => r.year)).toEqual(['2012', '2013']);
        expect(rows.map(r => [iso(r.__period_start as number), iso(r.__period_end as number)])).toEqual([
            ['2000-12-20T00:00:00.000Z', '2001-01-01T00:00:00.000Z'],
            ['2000-01-01T00:00:00.000Z', '2000-01-10T00:00:00.000Z']
        ]);
    });

    it('gives unparseable times no coordinate', () => {
        const [row] = applyTimeCoordinates([{ start: NaN, end: NaN }], config);
        expect(row.__period_start).toBeNaN();
        expect(row.year).toEqual('');
    });
});
