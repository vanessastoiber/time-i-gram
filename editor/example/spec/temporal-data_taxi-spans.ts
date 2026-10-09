import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// NYC taxi trips from a start time and a duration. The CSV stores each trip's duration in seconds
// (`trip_duration`), a span without a position in time; the `span` transform turns it into an interval from
// the pickup time to `dropoff`, drawn as an arc (as in Fig. 1C) in a one-hour window.
// Below, the same pickups in the period coordinate system: `period: "day"` puts all days on one 24-hour axis,
// and `timeUnit: "hour"` with `aggregate: "count"` counts the trips of each hour of the day, one row per vendor.

const TAXI = {
    url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/4_nyc-taxi-trip/nyc_taxi_trip_duration.csv',
    type: 'csv-time',
    dateFields: ['pickup_datetime']
} as const;

/** The two taxi technology vendors of the data set, by name (the CSV has their ids). */
const VENDOR_NAMES = {
    type: 'replace',
    field: 'vendor_id',
    newField: 'vendor',
    replace: [
        { from: '1', to: 'Creative Mobile Technologies' },
        { from: '2', to: 'VeriFone' }
    ]
} as const;

const VENDOR_COLOR = {
    field: 'vendor',
    type: 'nominal',
    domain: ['Creative Mobile Technologies', 'VeriFone'],
    range: ['#1f77b4', '#ff7f0e'],
    legend: true,
    title: 'Vendor'
} as const;

const spec = {
    title: 'When do New York taxi trips happen, and how long do they take?',
    subtitle: 'Top: one hour of trips on 3 February 2016. Bottom: all trips of January to June 2016 by hour of the day.',
    arrangement: 'vertical',
    views: [
        {
            tracks: [
                {
                    title: 'Each trip as an arc from pickup to drop-off (pickup time + trip duration)',
                    data: TAXI,
                    dataTransform: [
                        VENDOR_NAMES,
                        {
                            type: 'span',
                            field: 'pickup_datetime',
                            duration: 'trip_duration',
                            unit: 'second',
                            newField: 'dropoff'
                        }
                    ],
                    mark: 'withinLink',
                    x: {
                        field: 'pickup_datetime',
                        type: 'temporal',
                        axis: 'bottom',
                        domain: { interval: ['2016-02-03T12:35:00Z', '2016-02-03T13:35:00Z'] }
                    },
                    x1: { field: 'dropoff', type: 'temporal' },
                    stroke: VENDOR_COLOR,
                    strokeWidth: { value: 1 },
                    opacity: { value: 0.6 },
                    // arc height grows with the trip's duration (up to the track height)
                    style: { linkStyle: 'elliptical', linkMinHeight: 0.05 },
                    width: 800,
                    height: 220
                }
            ]
        },
        {
            tracks: [
                {
                    title: 'Pickups per hour of the day, all days',
                    data: TAXI,
                    dataTransform: [VENDOR_NAMES],
                    mark: 'bar',
                    x: { field: 'pickup_datetime', type: 'temporal', period: 'day', timeUnit: 'hour', axis: 'bottom' },
                    y: { field: 'id', type: 'quantitative', aggregate: 'count', axis: 'left', title: 'Trips (count)' },
                    row: { field: 'vendor', type: 'nominal', domain: VENDOR_COLOR.domain },
                    color: VENDOR_COLOR,
                    width: 800,
                    height: 220
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_TAXI_SPANS = spec as unknown as GoslingSpec;
