import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// NASA C-MAPSS FD002: 260 simulated engines run to failure by HPC degradation, each cycle flown at one of six
// operating conditions (altitude, Mach number and throttle resolver angle). 1 day = 1 cycle on a synthetic clock.
//
// Top: the HPC outlet static pressure (Ps30, s11) as measured. The operating condition sets its level, so every
// cycle falls on one of six bands and the degradation is hidden in their width; the lines are each band's mean
// per week before failure. Bottom: the same sensor as a z-score against the healthy cycles of its condition
// (pooled over the fleet), which removes the bands and shows the degradation. Both tracks align every engine to
// its failure (`anchor: "last"`, `groupby: "unit"`) and are in one view, so zoom one and the other follows.

const FD002 = {
    type: 'csv-time',
    url: 'https://raw.githubusercontent.com/denisseram/time-i-gram-datasets/6b38e3d/cmapss/fd002_train.csv',
    dateFields: ['date']
} as const;

/** The six operating conditions, by their labels in the legend (TRA, the throttle angle, is 100 unless noted). */
const CONDITIONS = [
    '0 kft, M0.00',
    '10 kft, M0.25',
    '20 kft, M0.70',
    '42 kft, M0.84',
    '35 kft, M0.84',
    '25 kft, M0.62, TRA 60'
];

/** Shorten the CSV's labels (e.g. "25 kft · M0.62 · TRA 60") for the legend; `replace` replaces substrings. */
const SHORT_CONDITION = {
    type: 'replace',
    field: 'condition',
    newField: 'flight',
    replace: [
        { from: ' · TRA 100', to: '' },
        { from: ' · ', to: ', ' }
    ]
} as const;

const X = {
    field: 'date',
    type: 'temporal',
    relative: { anchor: 'last', groupby: 'unit', unit: 'day', label: 'failure' },
    domain: { interval: ['-300 days', '0 days'] }
} as const;

const RAW = { field: 's11', type: 'quantitative', domain: [36, 49], axis: 'left', title: 'psia' } as const;
const NORMALIZED = {
    field: 's11_normalized',
    type: 'quantitative',
    domain: [-3, 7],
    axis: 'left',
    title: 'z'
} as const;

const spec = {
    title: 'Six flight conditions hide the wear. Normalizing by condition reveals it',
    subtitle: 'C-MAPSS FD002, 260 engines aligned to failure: HPC outlet static pressure (Ps30).',
    arrangement: 'vertical',
    views: [
        {
            spacing: 10,
            tracks: [
                {
                    title: 'As measured',
                    alignment: 'overlay',
                    data: FD002,
                    dataTransform: [SHORT_CONDITION],
                    x: { ...X, axis: 'none' },
                    y: RAW,
                    tracks: [
                        {
                            mark: 'point',
                            color: { field: 'flight', type: 'nominal', domain: CONDITIONS, legend: true },
                            opacity: { value: 0.15 },
                            size: { value: 1.5 }
                        },
                        {
                            mark: 'line',
                            x: { ...X, axis: 'none', timeUnit: 'week' },
                            y: { ...RAW, aggregate: 'mean' },
                            color: { field: 'flight', type: 'nominal', domain: CONDITIONS },
                            size: { value: 2 }
                        }
                    ],
                    width: 800,
                    height: 260
                },
                {
                    title: 'Normalized by operating condition (z-score against its healthy cycles, up = worse)',
                    alignment: 'overlay',
                    data: FD002,
                    x: { ...X, axis: 'bottom' },
                    y: NORMALIZED,
                    tracks: [
                        {
                            mark: 'point',
                            color: { value: '#7f8b99' },
                            opacity: { value: 0.12 },
                            size: { value: 1.5 }
                        },
                        {
                            mark: 'line',
                            x: { ...X, axis: 'bottom', timeUnit: 'week' },
                            y: { ...NORMALIZED, aggregate: 'mean' },
                            color: { value: '#1b1f24' },
                            size: { value: 3 },
                            style: { legendLabel: 'Fleet mean per week' }
                        }
                    ],
                    width: 800,
                    height: 200
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_CMAPSS_CONDITIONS = spec as unknown as GoslingSpec;
