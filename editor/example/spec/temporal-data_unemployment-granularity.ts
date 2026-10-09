import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// U.S. unemployment rate by industry, shown by calendar unit instead of raw timestamps, with granularity
// transition rules: `x.timeUnit` is a list of rules, so the same track is drawn by month while less than
// 4 years are visible and by year above. `aggregate: "mean"` on y averages the rows of each unit and series
// (the nominal color field). Domains are date strings and zoom limits are durations.
//
// Both views use the same track definition: the overview (10 years visible) is yearly, the brushed detail
// (2 years visible) is monthly. Zooming either view switches its granularity.

const UNEMPLOYMENT = {
    type: 'csv-time',
    url: 'https://raw.githubusercontent.com/denisseram/time-i-gram/14a22f2e66006df8a8498e2c0d6f992c5b49a810/unemployment-across-industries.csv',
    dateFields: ['date']
} as const;

const SERIES = ['Construction', 'Manufacturing', 'Finance', 'Information', 'Education and Health'];
const SERIES_FILTER = [{ type: 'filter', field: 'series', oneOf: SERIES }] as const;
const SERIES_COLOR = { field: 'series', type: 'nominal', domain: SERIES, legend: true, title: 'Industry' } as const;
const RATE = {
    field: 'rate',
    type: 'quantitative',
    aggregate: 'mean',
    domain: [0, 25],
    axis: 'left',
    title: 'Unemployment rate (%)'
} as const;

/** Granularity transition rules: monthly below 4 years of visible time, yearly above. */
const BY_MONTH_THEN_YEAR = [{ unit: 'month', maxSpan: '4 years' }, { unit: 'year' }];

const spec = {
    title: 'How did unemployment change by industry from 2000 to 2009?',
    subtitle: 'Monthly means while less than 4 years are visible, yearly means above: zoom either view to switch',
    zoomLimits: ['6 months', '20 years'],
    arrangement: 'vertical',
    views: [
        {
            // whole years only: a mean of the last, partial year (January and February 2010) would look like a year
            xDomain: { interval: ['2000', '2009-12'] },
            tracks: [
                {
                    title: 'Overview: 10 years visible, yearly means',
                    alignment: 'overlay',
                    data: UNEMPLOYMENT,
                    dataTransform: SERIES_FILTER,
                    x: { field: 'date', type: 'temporal', timeUnit: BY_MONTH_THEN_YEAR, axis: 'bottom' },
                    y: RATE,
                    color: SERIES_COLOR,
                    tracks: [
                        { mark: 'line', size: { value: 2 } },
                        { mark: 'point', size: { value: 4 } },
                        { mark: 'brush', x: { linkingId: 'detail' } }
                    ],
                    width: 800,
                    height: 160
                }
            ]
        },
        {
            xDomain: { interval: ['2008', '2009'] },
            linkingId: 'detail',
            tracks: [
                {
                    title: 'Detail: 2 years visible, monthly means',
                    alignment: 'overlay',
                    data: UNEMPLOYMENT,
                    dataTransform: SERIES_FILTER,
                    x: { field: 'date', type: 'temporal', timeUnit: BY_MONTH_THEN_YEAR, axis: 'bottom' },
                    y: RATE,
                    color: SERIES_COLOR,
                    tracks: [
                        { mark: 'line', size: { value: 2 } },
                        { mark: 'point', size: { value: 4 } }
                    ],
                    width: 800,
                    height: 220
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_UNEMPLOYMENT_GRANULARITY = spec as unknown as GoslingSpec;
