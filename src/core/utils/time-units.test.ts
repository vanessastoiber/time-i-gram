import {
    isoWeekday,
    utc,
    TIME_UNITS,
    UNIT_SECONDS,
    ceilUnitEnd,
    floorTime,
    isoWeekDate,
    isoWeekStart,
    isoWeeksInYear,
    offsetTime,
    parseDuration,
    parseTimeValue,
    parseUnitName
} from './time-units';

/** Unix seconds of an ISO date-time string (UTC). */
const s = (iso: string) => Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso) / 1000;

describe('floorTime', () => {
    const t = s('2010-08-18T13:45:30.250Z'); // a Wednesday
    it.each([
        ['millisecond', '2010-08-18T13:45:30.250Z'],
        ['second', '2010-08-18T13:45:30Z'],
        ['minute', '2010-08-18T13:45:00Z'],
        ['hour', '2010-08-18T13:00:00Z'],
        ['day', '2010-08-18'],
        ['week', '2010-08-16'], // ISO weeks start on Monday
        ['month', '2010-08-01'],
        ['quarter', '2010-07-01'],
        ['year', '2010-01-01'],
        ['decade', '2010-01-01']
    ] as const)('truncates to the start of the %s', (unit, expected) => {
        expect(floorTime(t, unit)).toBeCloseTo(s(expected), 6);
    });

    it('rounds toward the past before 1970', () => {
        expect(floorTime(s('1969-12-31T12:00:00Z'), 'day')).toEqual(s('1969-12-31'));
        expect(floorTime(s('1969-12-31T12:00:00Z'), 'week')).toEqual(s('1969-12-29'));
        expect(floorTime(s('1969-12-31T12:00:00Z'), 'hour')).toEqual(s('1969-12-31T12:00:00Z'));
        expect(floorTime(s('1918-09-15'), 'quarter')).toEqual(s('1918-07-01'));
        expect(floorTime(s('1955-06-01'), 'decade')).toEqual(s('1950-01-01'));
    });

    it('handles years before 100 (no 19xx mapping)', () => {
        expect(new Date(floorTime(s('0050-06-15'), 'year') * 1000).toISOString()).toEqual('0050-01-01T00:00:00.000Z');
    });

    it('is the identity on unit starts, including year boundaries', () => {
        for (const unit of TIME_UNITS) {
            const start = floorTime(s('2000-01-01'), unit);
            expect(floorTime(start, unit)).toEqual(start);
        }
        expect(floorTime(s('2000-12-31T23:59:59Z'), 'year')).toEqual(s('2000-01-01'));
        expect(floorTime(s('2001-01-01'), 'year')).toEqual(s('2001-01-01'));
    });
});

describe('offsetTime', () => {
    it('adds fixed units exactly', () => {
        expect(offsetTime(s('2010-01-01'), 'day', 3)).toEqual(s('2010-01-04'));
        expect(offsetTime(s('2010-01-01'), 'week', -1)).toEqual(s('2009-12-25'));
    });

    it('moves months on the calendar and clamps to the end of the month', () => {
        expect(offsetTime(s('2000-01-31'), 'month', 1)).toEqual(s('2000-02-29'));
        expect(offsetTime(s('2001-01-31'), 'month', 1)).toEqual(s('2001-02-28'));
        expect(offsetTime(s('2010-11-15T06:00:00Z'), 'quarter', 1)).toEqual(s('2011-02-15T06:00:00Z'));
        expect(offsetTime(s('2010-03-01'), 'month', -3)).toEqual(s('2009-12-01'));
    });

    it('handles 29 February + 1 year', () => {
        expect(offsetTime(s('2000-02-29'), 'year', 1)).toEqual(s('2001-02-28'));
        expect(offsetTime(s('2000-02-29'), 'year', 4)).toEqual(s('2004-02-29'));
    });

    it('gives the end of a unit', () => {
        expect(ceilUnitEnd(s('2010-12-15'), 'month')).toEqual(s('2011-01-01'));
        expect(ceilUnitEnd(s('1969-05-01'), 'decade')).toEqual(s('1970-01-01'));
    });
});

describe('ISO weeks', () => {
    it('finds the ISO week date', () => {
        expect(isoWeekDate(s('2010-01-04'))).toEqual({ year: 2010, week: 1, weekday: 1 });
        expect(isoWeekDate(s('2010-01-03'))).toEqual({ year: 2009, week: 53, weekday: 7 });
        expect(isoWeekDate(s('2013-12-30'))).toEqual({ year: 2014, week: 1, weekday: 1 });
        expect(isoWeekDate(s('2016-01-03'))).toEqual({ year: 2015, week: 53, weekday: 7 });
        expect(isoWeekDate(s('1969-12-31'))).toEqual({ year: 1970, week: 1, weekday: 3 });
    });

    it('counts 52 or 53 weeks per year', () => {
        expect(isoWeeksInYear(2009)).toEqual(53);
        expect(isoWeeksInYear(2010)).toEqual(52);
        expect(isoWeeksInYear(2015)).toEqual(53);
        expect(isoWeeksInYear(2020)).toEqual(53);
    });

    it('finds the Monday of an ISO week', () => {
        expect(isoWeekStart(2010, 1)).toEqual(s('2010-01-04'));
        expect(isoWeekStart(2014, 1)).toEqual(s('2013-12-30'));
        expect(isoWeekStart(2015, 53)).toEqual(s('2015-12-28'));
        expect(isoWeekStart(2010, 53)).toBeNaN();
        expect(isoWeekStart(2010, 0)).toBeNaN();
    });
});

describe('parseTimeValue', () => {
    it('keeps numbers (Unix seconds)', () => {
        expect(parseTimeValue(946684800)).toEqual(946684800);
        expect(parseTimeValue(-1, 'end')).toEqual(-1);
    });

    it('reads partial dates as the start of their unit', () => {
        expect(parseTimeValue('2000')).toEqual(s('2000-01-01'));
        expect(parseTimeValue('2000-01')).toEqual(946684800);
        expect(parseTimeValue('2010-12-31')).toEqual(s('2010-12-31'));
        expect(parseTimeValue('2010-Q4')).toEqual(s('2010-10-01'));
        expect(parseTimeValue('2015-W53')).toEqual(s('2015-12-28'));
        expect(parseTimeValue('1918-09')).toEqual(s('1918-09-01'));
    });

    it('reads partial dates as the end of their unit when used as an end', () => {
        expect(parseTimeValue('2010-12', 'end')).toEqual(1293840000); // 2011-01-01
        expect(parseTimeValue('2010', 'end')).toEqual(s('2011-01-01'));
        expect(parseTimeValue('2000-02-28', 'end')).toEqual(s('2000-02-29'));
        expect(parseTimeValue('2015-W53', 'end')).toEqual(s('2016-01-04'));
    });

    it('reads date-times as exact instants, UTC without a zone', () => {
        expect(parseTimeValue('2010-01-03T23:00:00Z')).toEqual(s('2010-01-03T23:00:00Z'));
        expect(parseTimeValue('2010-01-03T23:00:00Z', 'end')).toEqual(s('2010-01-03T23:00:00Z'));
        expect(parseTimeValue('2010-01-03 23:00')).toEqual(s('2010-01-03T23:00:00Z'));
        expect(parseTimeValue('2010-01-04T00:00:00+01:00')).toEqual(s('2010-01-03T23:00:00Z'));
        expect(parseTimeValue('2010-01-04T00:00:00.5Z')).toEqual(s('2010-01-04') + 0.5);
    });

    it('rejects invalid dates', () => {
        for (const bad of ['', 'Jan 2010', '2010-13', '2010-02-30', '2010-W54', '10-01-2010', '2010-01-01T25:00']) {
            expect(parseTimeValue(bad)).toBeNaN();
        }
    });
});

describe('parseDuration', () => {
    it('keeps numbers (seconds)', () => {
        expect(parseDuration(86400)).toEqual(86400);
    });

    it('reads singular, plural and short units', () => {
        expect(parseDuration('1 day')).toEqual(86400);
        expect(parseDuration('2 weeks')).toEqual(2 * 604800);
        expect(parseDuration('90 minutes')).toEqual(5400);
        expect(parseDuration('1.5 d')).toEqual(1.5 * 86400);
        expect(parseDuration('3h')).toEqual(3 * 3600);
        expect(parseDuration('250 ms')).toEqual(0.25);
    });

    it('uses nominal lengths for months and longer', () => {
        expect(parseDuration('1 month')).toBeCloseTo(30.436875 * 86400, 6);
        expect(parseDuration('3 months')).toEqual(parseDuration('1 quarter'));
        expect(parseDuration('1 year')).toEqual(365.2425 * 86400);
        expect(parseDuration('1 decade')).toEqual(10 * UNIT_SECONDS.year);
    });

    it('accepts signs', () => {
        expect(parseDuration('-36 months')).toEqual(-36 * UNIT_SECONDS.month);
        expect(parseDuration('+2 wk')).toEqual(2 * UNIT_SECONDS.week);
    });

    it('rejects invalid durations', () => {
        for (const bad of ['', 'month', '3 moons', '1 month 2 days', 'three days']) {
            expect(parseDuration(bad)).toBeNaN();
        }
    });

    it('reads unit names', () => {
        expect(parseUnitName('Months')).toEqual('month');
        expect(parseUnitName('hrs')).toEqual('hour');
        expect(parseUnitName('fortnight')).toBeUndefined();
    });
});

describe('fast calendar helpers', () => {
    it('utc() agrees with the Date API for every month boundary, overflowing months and years before 100', () => {
        const viaDate = (y: number, m: number, d: number) => {
            const date = new Date(Date.UTC(2000, 0, 1));
            date.setUTCFullYear(y, m - 1, d);
            return date.getTime() / 1000;
        };
        for (const year of [-5, 0, 1, 50, 99, 100, 1918, 1969, 1970, 2000, 2016, 9999]) {
            for (const month of [-1, 0, 1, 2, 12, 13, 25]) {
                for (const day of [0, 1, 29, 31]) expect(utc(year, month, day)).toEqual(viaDate(year, month, day));
            }
        }
        expect(utc(2016, 4, 12, 3600)).toEqual(Date.UTC(2016, 3, 12, 1) / 1000);
    });

    it('isoWeekday() is the weekday of isoWeekDate(), also before 1970', () => {
        for (let t = Date.UTC(1965, 0, 1) / 1000; t < Date.UTC(1965, 0, 1) / 1000 + 20 * 86400; t += 7919) {
            expect(isoWeekday(t)).toEqual(isoWeekDate(t).weekday);
        }
        expect(isoWeekday(Date.UTC(2016, 3, 17, 7) / 1000)).toEqual(7); // a Sunday
    });
});
