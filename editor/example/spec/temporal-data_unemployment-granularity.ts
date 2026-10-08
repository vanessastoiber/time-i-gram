import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// U.S. unemployment rate by industry, shown by calendar unit instead of raw timestamps:
// `x.timeUnit` places every row at the start of its year or month, and `aggregate: "mean"` on y averages
// the rows of each unit and series (the nominal color field). Domains are date strings and zoom limits
// are durations.

const UNEMPLOYMENT = {
    type: 'csv-time',
    url: 'https://raw.githubusercontent.com/denisseram/time-i-gram/14a22f2e66006df8a8498e2c0d6f992c5b49a810/unemployment-across-industries.csv',
    dateFields: ['date']
} as const;

const SERIES = ['Construction', 'Manufacturing', 'Finance', 'Information', 'Education and Health'];
const SERIES_FILTER = [{ type: 'filter', field: 'series', oneOf: SERIES }] as const;
const SERIES_COLOR = { field: 'series', type: 'nominal', domain: SERIES, legend: true } as const;
const RATE = { field: 'rate', type: 'quantitative', aggregate: 'mean', domain: [0, 25], axis: 'left' } as const;

const spec = {
    title: 'U.S. Unemployment Rate by Industry, by Year and by Month',
    subtitle: 'x.timeUnit with aggregate "mean": yearly overview, monthly detail of the brushed range',
    zoomLimits: ['6 months', '20 years'],
    arrangement: 'vertical',
    views: [
        {
            xDomain: { interval: ['2000', '2010-02'] },
            tracks: [
                {
                    title: 'Yearly mean (timeUnit: "year")',
                    alignment: 'overlay',
                    data: UNEMPLOYMENT,
                    dataTransform: SERIES_FILTER,
                    x: { field: 'date', type: 'temporal', timeUnit: 'year', axis: 'bottom' },
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
                    title: 'Monthly mean (timeUnit: "month")',
                    alignment: 'overlay',
                    data: UNEMPLOYMENT,
                    dataTransform: SERIES_FILTER,
                    x: { field: 'date', type: 'temporal', timeUnit: 'month', axis: 'bottom' },
                    y: RATE,
                    color: SERIES_COLOR,
                    tracks: [{ mark: 'line', size: { value: 2 } }, { mark: 'point', size: { value: 4 } }],
                    width: 800,
                    height: 220
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_UNEMPLOYMENT_GRANULARITY = spec as unknown as GoslingSpec;
