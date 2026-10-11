import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// NASA C-MAPSS FD003: 100 simulated engines run to failure under two fault modes, HPC (high-pressure compressor)
// and fan degradation. The source does not say which engine has which fault; the preprocessed CSV infers it from
// whether phi (s12, fuel flow / Ps30) falls (HPC, as in FD001, where all engines have that fault) or rises (fan)
// near failure: 56 HPC and 44 fan engines. The data count operational cycles: 1 day = 1 cycle on a synthetic clock.
//
// Every track is aligned to each engine's failure (`anchor: "last"`, `groupby: "unit"`). T50 rises toward failure
// in both modes; phi and the bypass ratio move in opposite directions, which is why they hardly correlate with the
// remaining life over the whole fleet. Thin lines are engines (one member per mode, so each mode keeps one color
// while the `unit` field still separates the lines); thick lines are the mean of each mode per week. The three
// tracks are in one view, so they share the x axis: zoom one and the others follow.

const FD003 = {
    type: 'csv-time',
    url: 'https://raw.githubusercontent.com/denisseram/time-i-gram-datasets/6b38e3d/cmapss/fd003_train.csv',
    dateFields: ['date']
} as const;

const MODES = [
    { mode: 'HPC (inferred)', engines: '#a0bcd8', mean: '#2c5d8f' },
    { mode: 'Fan (inferred)', engines: '#f5c08f', mean: '#c4620f' }
];

const X = {
    field: 'date',
    type: 'temporal',
    relative: { anchor: 'last', groupby: 'unit', unit: 'day', label: 'failure' },
    domain: { interval: ['-300 days', '0 days'] }
} as const;

function sensorTrack(field: string, title: string, yTitle: string, domain: [number, number], axis: boolean) {
    const y = { field, type: 'quantitative', domain, axis: 'left', title: yTitle } as const;
    return {
        title,
        alignment: 'overlay',
        data: FD003,
        x: axis ? { ...X, axis: 'bottom' } : { ...X, axis: 'none' },
        y,
        tracks: [
            ...MODES.map(m => ({
                mark: 'line',
                dataTransform: [{ type: 'filter', field: 'fault_mode', oneOf: [m.mode] }],
                color: { field: 'unit', type: 'nominal', range: [m.engines] },
                opacity: { value: 0.3 },
                size: { value: 1 }
            })),
            {
                mark: 'line',
                x: { ...X, timeUnit: 'week', axis: axis ? 'bottom' : 'none' },
                y: { ...y, aggregate: 'mean' },
                color: {
                    field: 'fault_mode',
                    type: 'nominal',
                    domain: MODES.map(m => m.mode),
                    range: MODES.map(m => m.mean),
                    legend: true
                },
                size: { value: 3 }
            }
        ],
        width: 800,
        height: 170
    };
}

const spec = {
    title: 'Two faults, one fleet: which sensors tell them apart?',
    subtitle:
        'C-MAPSS FD003, 100 engines aligned to failure. Fan-degraded engines live longer: 320 vs 196 cycles (median).',
    arrangement: 'vertical',
    views: [
        {
            spacing: 10,
            tracks: [
                sensorTrack('s4', 'T50, LPT outlet temperature: rises in both modes', '°R', [1380, 1440], false),
                sensorTrack(
                    's12',
                    'phi, fuel flow / Ps30: falls under HPC, rises under fan degradation',
                    'pps/psi',
                    [516, 538],
                    false
                ),
                sensorTrack(
                    's15',
                    'BPR, bypass ratio: rises under HPC, falls under fan degradation',
                    'Ratio',
                    [8.15, 8.58],
                    true
                )
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_CMAPSS_FAULT_MODES = spec as unknown as GoslingSpec;
