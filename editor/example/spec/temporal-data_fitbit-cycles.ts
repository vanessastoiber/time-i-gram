import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// FitBit heart rate (one participant, 12 April to 12 May 2016) in two period coordinate systems:
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
    title: 'FitBit Heart Rate: Weekly and Daily Cycles',
    subtitle:
        'Left: period "week", one ring per week (Monday at the top). Right: period "day", all days on one 24-hour axis.',
    arrangement: 'horizontal',
    views: [
        {
            layout: 'circular',
            centerRadius: 0.25,
            tracks: [
                {
                    data: HEART_RATE,
                    dataTransform: ONE_PARTICIPANT,
                    mark: 'point',
                    x: { field: 'Time', type: 'temporal', period: { unit: 'week', newField: 'week' }, axis: 'top' },
                    y: { field: 'Value', type: 'quantitative', domain: [50, 180], axis: 'none' },
                    row: { field: 'week', type: 'nominal' },
                    color: { field: 'week', type: 'nominal', legend: true },
                    size: { value: 1 },
                    opacity: { value: 0.4 },
                    width: 420,
                    height: 160
                }
            ]
        },
        {
            tracks: [
                {
                    title: 'Heart rate by time of day (all days)',
                    data: HEART_RATE,
                    dataTransform: ONE_PARTICIPANT,
                    mark: 'point',
                    x: { field: 'Time', type: 'temporal', period: 'day', axis: 'bottom' },
                    y: { field: 'Value', type: 'quantitative', domain: [50, 180], axis: 'left' },
                    color: { value: '#d62728' },
                    size: { value: 1 },
                    opacity: { value: 0.08 },
                    width: 480,
                    height: 300
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_FITBIT_CYCLES = spec as unknown as GoslingSpec;
