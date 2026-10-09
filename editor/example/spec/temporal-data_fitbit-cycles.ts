import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// FitBit heart rate (one participant, 12 April to 12 May 2016) in two period coordinate systems, as hourly means
// (`timeUnit: "hour"` with `aggregate: "mean"`):
// - a weekly clock: `period: "week"` wraps the time axis by ISO week (Monday at 12 o'clock), and the row
//   channel on each row's week (`newField: "week"`) draws one concentric ring per week;
// - a daily cycle: `period: "day"` superposes all days on one 24-hour axis.
// The two views use different period systems, so they are not linked.

const HEART_RATE = {
    url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/6_fitbit/heartrate_seconds_merged.csv',
    type: 'csv-time',
    dateFields: ['Time']
} as const;

const ONE_PARTICIPANT = [{ type: 'filter', field: 'Id', oneOf: ['2022484408'] }] as const;

const spec = {
    title: 'FitBit heart rate: is it higher at weekends, and at what time of day?',
    subtitle:
        'Hourly means, one participant, April to May 2016. Left: a ring per week (Monday at the top). Right: all days.',
    arrangement: 'horizontal',
    views: [
        {
            layout: 'circular',
            centerRadius: 0.25,
            tracks: [
                {
                    data: HEART_RATE,
                    dataTransform: ONE_PARTICIPANT,
                    // the raw data has a value every few seconds (154,000 for this participant): drawing hourly
                    // means keeps the views readable and interactive
                    mark: 'line',
                    x: {
                        field: 'Time',
                        type: 'temporal',
                        period: { unit: 'week', newField: 'week' },
                        timeUnit: 'hour',
                        axis: 'top'
                    },
                    y: { field: 'Value', type: 'quantitative', aggregate: 'mean', domain: [50, 130], axis: 'none' },
                    row: { field: 'week', type: 'nominal' },
                    color: { field: 'week', type: 'nominal', legend: true },
                    size: { value: 1.5 },
                    width: 420,
                    height: 160
                }
            ]
        },
        {
            tracks: [
                {
                    title: 'Mean heart rate by hour of the day (all days)',
                    data: HEART_RATE,
                    dataTransform: ONE_PARTICIPANT,
                    mark: 'bar',
                    x: { field: 'Time', type: 'temporal', period: 'day', timeUnit: 'hour', axis: 'bottom' },
                    y: { field: 'Value', type: 'quantitative', aggregate: 'mean', domain: [0, 130], axis: 'left' },
                    color: { value: '#d62728' },
                    stroke: { value: 'white' },
                    strokeWidth: { value: 1 },
                    width: 480,
                    height: 300
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_FITBIT_CYCLES = spec as unknown as GoslingSpec;
