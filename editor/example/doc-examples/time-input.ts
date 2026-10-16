import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Doc examples of time input formats (not figures): a date and a time of day in two columns, and Unix timestamps
// in seconds and in milliseconds.

/**
 * Date + time columns: NYC Motor Vehicle Collisions, June 2024, read from NYC Open Data's API (public domain).
 * `crash_date` holds `2024-06-01T00:00:00.000` and `crash_time` holds `0:05` or `13:40`: with two `dateFields`,
 * the second is read as the time of day of the first.
 */
export const TIME_INPUT_DATE_AND_TIME: GoslingSpec = {
    title: 'When in the day do New York crashes happen?',
    subtitle:
        'Collisions in June 2024, from a date and a time-of-day column. Source: NYPD, NYC Open Data (h9gi-nx95)',
    tracks: [
        {
            title: 'Crashes per hour (per day when more than 10 days are visible)',
            data: {
                type: 'csv-time',
                url:
                    'https://data.cityofnewyork.us/resource/h9gi-nx95.csv?' +
                    '$select=crash_date,crash_time,borough' +
                    "&$where=crash_date between '2024-06-01T00:00:00' and '2024-06-30T00:00:00'" +
                    '&$limit=50000',
                dateFields: ['crash_date', 'crash_time']
            },
            mark: 'bar',
            x: {
                field: 'crash_date',
                type: 'temporal',
                timeUnit: [{ unit: 'hour', maxSpan: '10 days' }, { unit: 'day' }],
                axis: 'bottom',
                domain: { interval: ['2024-06-03', '2024-06-09'] }
            },
            y: { field: 'crash_time', type: 'quantitative', aggregate: 'count', domain: [0, 50], axis: 'left', title: 'Crashes' },
            color: { value: '#4e79a7' },
            tooltip: [
                { field: 'crash_date', type: 'temporal', alt: 'Hour' },
                { field: 'crash_time', type: 'quantitative', alt: 'Crashes' }
            ],
            width: 800,
            height: 200
        }
    ]
};

/** Apollo 11, from the NASA History Office's mission overview; times in UTC, before 1970 (negative). */
const APOLLO_11 = [
    { event: 'Launch', s: -14552880 },
    { event: 'Lunar orbit insertion', s: -14279890 },
    { event: 'Landing', s: -14182940 },
    { event: 'First step', s: -14159025 },
    { event: 'Lunar liftoff', s: -14105160 },
    { event: 'Splashdown', s: -13849765 }
];

/** One track of Apollo 11 events whose times are Unix timestamps in `unit`. */
function apolloTrack(unit: 's' | 'ms', title: string, axis: 'top' | 'bottom') {
    return {
        title,
        alignment: 'overlay',
        data: {
            type: 'json-time',
            values: APOLLO_11.map(e => ({ event: e.event, t: unit === 's' ? e.s : e.s * 1000 })),
            timestampField: 't',
            timestampUnit: unit
        },
        x: { field: 't', type: 'temporal', axis, domain: { interval: ['1969-07-16', '1969-07-25'] } },
        tracks: [
            { mark: 'point', color: { value: '#e15759' }, size: { value: 5 } },
            // labels below the points, except First step above, so that the events of 20 and 21 July do not overlap
            ...[
                [false, -12],
                [true, 12]
            ].map(([below, dy]) => ({
                mark: 'text',
                dataTransform: [{ type: 'filter', field: 'event', oneOf: ['First step'], not: !below }],
                text: { field: 'event', type: 'nominal' },
                color: { value: '#333333' },
                style: { dy, textFontSize: 11 }
            }))
        ],
        width: 800,
        height: 80
    };
}

/** Unix timestamps in seconds and in milliseconds (`timestampField`, `timestampUnit`), as inline JSON values. */
export const TIME_INPUT_UNIX_TIMESTAMPS: GoslingSpec = {
    title: 'How long did the Apollo 11 mission take, from launch to splashdown?',
    subtitle: 'The same six events as Unix seconds (top) and milliseconds (bottom). Source: NASA History Office',
    views: [
        {
            spacing: 10,
            tracks: [
                apolloTrack('s', 'Unix seconds (timestampUnit: "s")', 'top'),
                apolloTrack('ms', 'Unix milliseconds (timestampUnit: "ms")', 'bottom')
            ]
        }
    ]
} as unknown as GoslingSpec;
