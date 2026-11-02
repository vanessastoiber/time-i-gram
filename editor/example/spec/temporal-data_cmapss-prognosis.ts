import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// NASA C-MAPSS FD001 test set: 100 engines whose records stop some time before failure; the true remaining
// useful life (RUL) at the last record is given separately. The preprocessed CSVs store each engine's failure
// as a date column (`failure_date` = last cycle + RUL, on the synthetic clock of 1 day per cycle); the axes name
// the offsets cycles (`relative.unitName`).
//
// `anchor: { field: "failure_date" }` reads the reference event from each row, so every engine is aligned to a
// failure that is not in its records. Top: the health index of every engine ends short of 0. Bottom: one row per
// engine, sorted by RUL; the blue bar is what was observed, and the orange bar, from the last record to the
// failure (`span`: last record + RUL in days), is what a prognosis has to predict. The rows' title and legend are in
// a track of their own above them: 100 rows leave no room for a header. Both views measure from the
// same event in the same unit, so they are in one coordinate system and linked: zoom one and the other follows.

const TEST = {
    type: 'csv-time',
    url: 'https://raw.githubusercontent.com/denisseram/time-i-gram-datasets/6b38e3d/cmapss/fd001_test.csv',
    dateFields: ['date']
} as const;

const ENGINES = {
    type: 'csv-time',
    url: 'https://raw.githubusercontent.com/denisseram/time-i-gram-datasets/6b38e3d/cmapss/fd001_test_engines.csv',
    interval: ['start_date', 'last_date']
} as const;

/** The test engines sorted by their RUL at the last record, shortest first. */
const BY_RUL = (
    '34 31 68 81 82 42 76 35 66 56 20 41 36 24 92 100 37 49 61 53 18 40 64 90 52 77 58 91 46 32 17 ' +
    '38 72 62 94 21 84 43 98 79 27 3 63 67 50 4 97 15 16 93 19 86 29 80 5 7 48 6 70 8 13 10 11 28 54 ' +
    '2 60 57 33 14 78 44 9 22 1 23 75 45 51 59 30 88 87 99 71 85 26 69 12 74 65 95 73 47 89 55 83 96 ' +
    '39 25'
).split(' ');

const X = {
    type: 'temporal',
    relative: { anchor: { field: 'failure_date' }, unit: 'day', unitName: 'cycle', label: 'the true failure' },
    domain: { interval: ['-345 days', '0 days'] },
    axis: 'bottom',
    linkingId: 'failure'
} as const;

const spec = {
    title: 'How far from failure is each engine when its records stop?',
    subtitle: 'NASA C-MAPSS FD001 test set (Saxena et al. 2008): 100 simulated engines, each stopped before failure',
    arrangement: 'vertical',
    views: [
        {
            tracks: [
                {
                    title: 'Health index of each engine up to its last record',
                    data: TEST,
                    mark: 'line',
                    x: { ...X, field: 'date' },
                    y: {
                        field: 'hi_smooth',
                        type: 'quantitative',
                        domain: [-1, 7.5],
                        axis: 'left',
                        title: 'Health index (z, up = worse)'
                    },
                    // one line per engine: the color channel separates the lines, all drawn in one blue
                    color: { field: 'unit', type: 'nominal', domain: BY_RUL, range: ['#4e79a7'] },
                    opacity: { value: 0.4 },
                    size: { value: 1 },
                    width: 800,
                    height: 220
                }
            ]
        },
        {
            spacing: 0,
            tracks: [
                {
                    // the title and legend of the rows below, which leave no room for a header of their own
                    title: 'One row per engine, sorted by remaining useful life',
                    data: ENGINES,
                    dataTransform: [{ type: 'filter', field: 'unit', oneOf: [] }],
                    alignment: 'overlay',
                    x: { ...X, field: 'start_date', axis: 'none' },
                    tracks: [
                        {
                            mark: 'rect',
                            color: { value: '#4e79a7' },
                            style: { legendTitle: 'Cycles', legendLabel: 'Observed' }
                        },
                        { mark: 'rect', color: { value: '#f9be86' }, style: { legendLabel: 'Remaining useful life' } }
                    ],
                    width: 800,
                    height: 20
                },
                {
                    data: ENGINES,
                    alignment: 'overlay',
                    row: { field: 'unit', type: 'nominal', domain: BY_RUL, padding: 0.5 },
                    tracks: [
                        {
                            mark: 'rect',
                            x: { ...X, field: 'start_date' },
                            xe: { field: 'last_date', type: 'temporal' },
                            color: { value: '#4e79a7' }
                        },
                        {
                            mark: 'rect',
                            dataTransform: [
                                { type: 'span', field: 'last_date', duration: 'rul_end', unit: 'day', newField: 'end' }
                            ],
                            x: { ...X, field: 'last_date' },
                            xe: { field: 'end', type: 'temporal' },
                            // opaque: a rect that spans two tiles is drawn by both
                            color: { value: '#f9be86' }
                        }
                    ],
                    width: 800,
                    height: 420
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_CMAPSS_PROGNOSIS = spec as unknown as GoslingSpec;
