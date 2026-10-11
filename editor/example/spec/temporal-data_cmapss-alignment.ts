import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// NASA C-MAPSS FD001: 100 simulated turbofan engines run from a healthy state to failure (Saxena et al., PHM08).
// The data count operational cycles, not dates: the preprocessed CSV gives every engine a synthetic clock
// (2000-01-01 + 1 day per cycle), so offsets in days read as cycles and dates are never shown.
// `hi_smooth` is a health index (mean z-score of 12 sensors against the engine's first 30 cycles, up = worse).
//
// The two views differ only in the anchor of `x.relative`. Top: each engine from its own first cycle
// (`anchor: "first"`, `groupby: "unit"`); the engines fail at different ages, so the curves fan out. Bottom:
// each engine up to its own last cycle (`anchor: "last"`), the failure; the curves collapse onto one course.
// In both, `timeUnit: "week"` with `aggregate: "mean"` bins the offsets into whole weeks from the anchor and
// draws the fleet's mean. Both views are relative, but to different events, so they are not linked.

const FD001 = {
    type: 'csv-time',
    url: 'https://raw.githubusercontent.com/denisseram/time-i-gram-datasets/6b38e3d/cmapss/fd001_train.csv',
    dateFields: ['date']
} as const;

/** The shortest-, median- and longest-lived engines, named in a field of their own: a legend shows every
 * category of its field across the members of an overlay, so it cannot reuse `unit` (100 grey lines). */
const HIGHLIGHT = [
    { from: '39', to: 'Shortest life (128)' },
    { from: '68', to: 'Median (199)' },
    { from: '69', to: 'Longest (362)' }
];
const HIGHLIGHT_COLOR = {
    field: 'engine',
    type: 'nominal',
    domain: HIGHLIGHT.map(h => h.to),
    range: ['#e15759', '#f28e2b', '#4e79a7'],
    legend: true
} as const;

const Y = {
    field: 'hi_smooth',
    type: 'quantitative',
    domain: [-1, 7.5],
    axis: 'left',
    title: 'Health index (z, up = worse)'
} as const;

function view(anchor: 'first' | 'last', title: string, label: string, interval: [string, string]) {
    const x = {
        field: 'date',
        type: 'temporal',
        relative: { anchor, groupby: 'unit', unit: 'day', label },
        domain: { interval },
        axis: 'bottom'
    } as const;
    return {
        tracks: [
            {
                title,
                alignment: 'overlay',
                data: FD001,
                x,
                y: Y,
                tracks: [
                    {
                        // one line per engine: the color channel separates the lines, all drawn in one grey
                        mark: 'line',
                        color: { field: 'unit', type: 'nominal', range: ['#9aa5b1'] },
                        opacity: { value: 0.35 },
                        size: { value: 1 }
                    },
                    {
                        mark: 'line',
                        dataTransform: [
                            { type: 'filter', field: 'unit', oneOf: HIGHLIGHT.map(h => h.from) },
                            { type: 'replace', field: 'unit', newField: 'engine', replace: HIGHLIGHT }
                        ],
                        color: HIGHLIGHT_COLOR,
                        size: { value: 2 }
                    },
                    {
                        mark: 'line',
                        x: { ...x, timeUnit: 'week' },
                        y: { ...Y, aggregate: 'mean' },
                        color: { value: '#1b1f24' },
                        size: { value: 3 },
                        style: { legendLabel: 'Fleet mean' }
                    }
                ],
                width: 800,
                height: 240
            }
        ]
    };
}

const spec = {
    title: 'When do jet engines wear out? It depends on what you align them to',
    subtitle: 'NASA C-MAPSS FD001: 100 simulated engines run to failure. 1 day = 1 operating cycle.',
    arrangement: 'vertical',
    views: [
        view('first', 'Aligned to the first cycle: the engines fail at different ages', 'entry into service', [
            '0 days',
            '370 days'
        ]),
        view('last', 'Aligned to the failure: degradation follows one course', 'failure', ['-370 days', '0 days'])
    ]
};

export const EX_SPEC_TEMPORAL_CMAPSS_ALIGNMENT = spec as unknown as GoslingSpec;
