import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Hourly PM2.5 at two stations of the Beijing Multi-Site Air-Quality Data (Zhang et al. 2017; UCI, CC BY 4.0),
// March 2013 to February 2017. The CSVs are the UCI files, unmodified: the time is in four columns (`year`, `month`,
// `day`, `hour`), read as date components (`dateFields` with several fields); the result is stored in `year`.
// Times are Beijing local time, drawn as if they were UTC.
//
// - Calendar (van Wijk and van Selow, 1999): one winter as a grid, weeks as rows and Monday to Sunday as columns
//   (`period: "week"` with `row` on each row's week, `timeUnit: "day"` with `aggregate: "mean"` on color).
// - Weekly cycle (Cleveland's cycle plot): the mean of every hour of the week, heating season against the rest.
// - Heating years (November to October, `period.start: 11`), one row per year and one view per station: a faceted
//   and segmented timeline.
// - Overview and detail in absolute time, one track per station; the detail opens on the smog of December 2015
//   (domains as ISO weeks and quarters) and its points show the time in tooltips.
//
// The calendar shares the overview's `linkingId`, but it is in another time coordinate system (a position in a
// week stands for every week): the grammar splits the link, links the absolute views only, and logs a warning.
//
// Layout notes:
// - The header strip (title, y title, legend) is at the top of every row of a track: the calendar's rows, which fill
//   their rows (no y), start with an empty category ('') that the header covers.
// - A `filter` compares numbers, so the calendar's winter is given in Unix seconds.
// - The quantitative color legend is drawn inside its track: it is in a track of its own, without marks, so that it
//   does not cover the calendar.
// - The stations are juxtaposed, not overlaid: overlaid members with different data become separate tracks, whose
//   headers (and so their y ranges) differ.

const station = (name: string) => ({
    type: 'csv-time',
    url: `https://raw.githubusercontent.com/denisseram/time-i-gram-datasets/629c6fc/beijing/PRSA_Data_${name}_20130301-20170228.csv`,
    dateFields: ['year', 'month', 'day', 'hour']
});
const DONGSI = station('Dongsi');
const DINGLING = station('Dingling');

/** Winter 2015/16: Monday 5 October 2015 (ISO week 41) to Sunday 3 April 2016 (week 13), in Unix seconds. */
const WINTER = [{ type: 'filter', field: 'year', inRange: [1444003200, 1459727999] }];
/** The weeks of that winter, as the period field names them, after an empty row under the header. */
const WINTER_WEEKS = [
    '',
    ...Array.from({ length: 13 }, (_, i) => `2015-W${41 + i}`),
    ...Array.from({ length: 13 }, (_, i) => `2016-W${String(i + 1).padStart(2, '0')}`)
];
/** Heating years as the period field names them (2012/13 starts in March 2013, 2016/17 ends in February 2017). */
const HEATING_YEARS = ['2012/13', '2013/14', '2014/15', '2015/16', '2016/17'];

/** The heating season of Beijing runs from 15 November to 15 March; whole months approximate it. */
const HEATING = { type: 'filter', field: 'month', oneOf: ['11', '12', '1', '2', '3'] };
const NOT_HEATING = { ...HEATING, not: true };

const PM25 = { field: 'PM2.5', type: 'quantitative', aggregate: 'mean' } as const;
const PM25_TITLE = 'PM2.5 (µg/m³)';
// the legend's title is short: a quantitative legend is drawn inside its track, which is narrow here
const PM25_COLOR = { ...PM25, domain: [0, 300], range: 'hot', title: 'µg/m³' } as const;

const ORANGE = '#c4620f';
const BLUE = '#2c5d8f';
const GREY = '#7f8b99';

const CALENDAR_X = {
    field: 'year',
    type: 'temporal',
    period: { unit: 'week', newField: 'week' },
    timeUnit: 'day'
} as const;

/** One heating year per row, daily means. */
function heatingYears(data: object, name: string, color: string) {
    return {
        title: `${name}: daily mean PM2.5 (µg/m³), one row per heating year (November to October)`,
        data,
        mark: 'bar',
        x: {
            field: 'year',
            type: 'temporal',
            period: { unit: 'year', start: 11, newField: 'heating_year' },
            timeUnit: 'day',
            axis: 'bottom'
        },
        y: { ...PM25, domain: [0, 400], axis: 'left' },
        row: { field: 'heating_year', type: 'nominal', domain: HEATING_YEARS, legend: true },
        color: { value: color },
        width: 790,
        height: 620
    };
}

/** One station's PM2.5 in absolute time, `timeUnit` as given. */
function stationTrack(data: object, name: string, color: string, timeUnit: unknown, yMax: number, height: number, more: object[]) {
    return {
        title: name,
        alignment: 'overlay',
        data,
        x: { field: 'year', type: 'temporal', timeUnit, axis: 'bottom' },
        y: { ...PM25, domain: [0, yMax], axis: 'left', title: PM25_TITLE },
        tracks: [{ mark: 'line', color: { value: color } }, ...more],
        width: 1620,
        height
    };
}

/** Points that show the time and value of each hour on hover. */
const hoverPoints = (name: string, color: string) => ({
    mark: 'point',
    size: { value: 2 },
    color: { value: color },
    tooltip: [
        { field: 'year', type: 'temporal', alt: 'Time (Beijing)' },
        { field: 'PM2.5', type: 'quantitative', alt: `PM2.5 at ${name} (µg/m³)`, format: '.0f' }
    ]
});

const DETAIL_UNITS = [{ unit: 'hour', maxSpan: '30 days' }, { unit: 'day' }];

const spec = {
    title: "When is Beijing's air worst: which hours, which weekdays, which winters?",
    subtitle:
        'Hourly PM2.5 at two stations, March 2013 to February 2017. Source: Zhang et al. 2017, UCI Beijing Multi-Site Air-Quality Data (CC BY 4.0)',
    arrangement: 'vertical',
    spacing: 40,
    zoomLimits: ['6 hours', '5 years'],
    views: [
        {
            arrangement: 'horizontal',
            spacing: 40,
            views: [
                {
                    spacing: 0,
                    tracks: [
                        {
                            title: 'Dongsi, winter 2015/16: daily mean PM2.5, one row per ISO week',
                            data: DONGSI,
                            dataTransform: WINTER,
                            mark: 'rect',
                            // a link across coordinate systems: split by the grammar, with a warning
                            x: { ...CALENDAR_X, axis: 'bottom', linkingId: 'beijing' },
                            row: { field: 'week', type: 'nominal', domain: WINTER_WEEKS, legend: true },
                            color: PM25_COLOR,
                            stroke: { value: 'white' },
                            strokeWidth: { value: 1 },
                            width: 330,
                            height: 540
                        },
                        {
                            // the color legend of the calendar, in a track of its own (no rows match the filter)
                            data: DONGSI,
                            dataTransform: [{ type: 'filter', field: 'station', oneOf: [] }],
                            mark: 'rect',
                            x: { ...CALENDAR_X, axis: 'none' },
                            color: { ...PM25_COLOR, legend: true },
                            style: { outline: 'none' },
                            width: 330,
                            height: 110
                        }
                    ]
                },
                {
                    tracks: [
                        {
                            title: 'Dongsi: mean by hour of the week',
                            alignment: 'overlay',
                            data: DONGSI,
                            x: { field: 'year', type: 'temporal', period: 'week', timeUnit: 'hour', axis: 'bottom' },
                            y: { ...PM25, domain: [0, 200], axis: 'left', title: PM25_TITLE },
                            tracks: [
                                {
                                    mark: 'line',
                                    dataTransform: [HEATING],
                                    color: { value: ORANGE },
                                    size: { value: 2 },
                                    style: { legendTitle: 'Months', legendLabel: 'November to March (heating)' }
                                },
                                {
                                    mark: 'line',
                                    dataTransform: [NOT_HEATING],
                                    color: { value: GREY },
                                    size: { value: 2 },
                                    style: { legendLabel: 'April to October' }
                                }
                            ],
                            width: 1250,
                            height: 650
                        }
                    ]
                }
            ]
        },
        {
            arrangement: 'horizontal',
            spacing: 40,
            views: [
                { tracks: [heatingYears(DONGSI, 'Dongsi (urban)', ORANGE)] },
                { tracks: [heatingYears(DINGLING, 'Dingling (rural)', BLUE)] }
            ]
        },
        {
            xDomain: { interval: ['2013-Q2', '2016-Q4'] },
            spacing: 0,
            tracks: [
                stationTrack(DONGSI, 'Overview, weekly means (brush to zoom the detail): Dongsi (urban)', ORANGE, 'week', 400, 110, [
                    { mark: 'brush', x: { linkingId: 'beijing' }, color: { value: 'steelBlue' } }
                ]),
                stationTrack(DINGLING, 'Dingling (rural)', BLUE, 'week', 400, 110, [])
            ]
        },
        {
            xDomain: { interval: ['2015-W49', '2015-W51'] },
            linkingId: 'beijing',
            spacing: 0,
            tracks: [
                stationTrack(DONGSI, 'Detail, hourly (daily means above 30 days; hover for the time): Dongsi (urban)', ORANGE, DETAIL_UNITS, 900, 170, [
                    hoverPoints('Dongsi', ORANGE)
                ]),
                stationTrack(DINGLING, 'Dingling (rural)', BLUE, DETAIL_UNITS, 900, 170, [hoverPoints('Dingling', BLUE)])
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_BEIJING_AIR = spec as unknown as GoslingSpec;
