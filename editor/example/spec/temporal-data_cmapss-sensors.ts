import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// NASA C-MAPSS FD001: six sensors of 100 simulated engines that fail by HPC (high-pressure compressor) degradation.
// The preprocessed long CSV has one row per engine, cycle and sensor, with the sensor's z-score against the
// engine's own first 30 cycles, signed so that up = degradation; 1 day = 1 cycle on a synthetic clock.
//
// Each track filters one sensor from the same data and aligns every engine to its failure (`anchor: "last"`,
// `groupby: "unit"`). The thick line is the fleet's mean with granularity transition rules: zoomed out, the mean of
// each week before failure; below 60 days of visible time, the mean of each cycle. The tracks are in one view,
// so they share the x axis: zoom one and the others follow.

const SENSORS_LONG = {
    type: 'csv-time',
    url: 'https://raw.githubusercontent.com/denisseram/time-i-gram-datasets/6b38e3d/cmapss/fd001_train_sensors_long.csv',
    dateFields: ['date']
} as const;

/** The six sensors that track HPC degradation most closely, by |correlation with remaining life| (0.70 to 0.64). */
const SENSORS = [
    { sensor: 'Ps30', title: 'Ps30, HPC outlet static pressure', color: '#e15759' },
    { sensor: 'T50', title: 'T50, LPT outlet temperature', color: '#f28e2b' },
    { sensor: 'phi', title: 'phi, fuel flow / Ps30 (sign flipped: it falls)', color: '#edc948' },
    { sensor: 'P30', title: 'P30, HPC outlet pressure (sign flipped: it falls)', color: '#59a14f' },
    { sensor: 'BPR', title: 'BPR, bypass ratio', color: '#4e79a7' },
    { sensor: 'W32', title: 'W32, LPT coolant bleed (sign flipped: it falls)', color: '#b07aa1' }
];

const X = {
    field: 'date',
    type: 'temporal',
    relative: { anchor: 'last', groupby: 'unit', unit: 'day', label: 'failure' },
    domain: { interval: ['-250 days', '0 days'] }
} as const;

const Y = { field: 'z', type: 'quantitative', domain: [-3, 9], axis: 'left', title: 'z' } as const;

function sensorTrack(s: (typeof SENSORS)[number], last: boolean) {
    const axis = last ? 'bottom' : 'none';
    return {
        title: s.title,
        alignment: 'overlay',
        data: SENSORS_LONG,
        dataTransform: [{ type: 'filter', field: 'sensor', oneOf: [s.sensor] }],
        x: { ...X, axis },
        y: Y,
        tracks: [
            {
                // one line per engine: the color channel separates the lines, all drawn in one grey
                mark: 'line',
                color: { field: 'unit', type: 'nominal', range: ['#b4bcc6'] },
                opacity: { value: 0.2 },
                size: { value: 1 }
            },
            {
                mark: 'line',
                x: {
                    ...X,
                    axis,
                    timeUnit: [{ unit: 'day', maxSpan: '60 days' }, { unit: 'week' }]
                },
                y: { ...Y, aggregate: 'mean' },
                color: { value: s.color },
                size: { value: 2.5 },
                style: { legendLabel: 'Fleet mean' }
            }
        ],
        width: 800,
        height: 105
    };
}

const spec = {
    title: 'The signature of a compressor fault, sensor by sensor',
    subtitle: 'C-MAPSS FD001, 100 engines aligned to failure. z-score against each engine’s healthy start, up = worse.',
    arrangement: 'vertical',
    views: [{ spacing: 6, tracks: SENSORS.map((s, i) => sensorTrack(s, i === SENSORS.length - 1)) }]
};

export const EX_SPEC_TEMPORAL_CMAPSS_SENSORS = spec as unknown as GoslingSpec;
