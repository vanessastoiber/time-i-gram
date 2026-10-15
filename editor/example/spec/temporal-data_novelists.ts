import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Lives and masterpieces of 24 novelists born after 1700, from Wikidata (CC0): two SPARQL queries run on
// 2026-10-15, whose CSV exports are used unedited (time-i-gram-datasets/novelists, with the queries). A
// masterpiece is a notable work (P800) that is a literary work, has articles in at least 30 Wikipedias, and was
// first published (the earliest P577, the first edition) in the writer's lifetime or up to 10 years after.
//
// - Top: the lives in absolute time, one row per writer (Priestley's Chart of Biography; Brehmer's linear
//   chronological faceted timeline), with each masterpiece at its first edition.
// - Bottom: the same, aligned to each writer's birth (`relative.anchor: { field: "birth" }`): the axis reads ages
//   (Accurat's "From first published to masterpieces"; Brehmer's linear and radial relative faceted timelines).
//   The ring and the linear view are in the same relative coordinate system, so the ring's brush (a range of ages)
//   zooms the linear view. The lives view is in absolute time and is not linked to them.
//
// Layout notes:
// - Rows start with an empty category ('') that the header strip covers (rects fill their rows).
// - Lives and works come from two files, so each view is two tracks; only one of them draws the row labels.

const BASE = 'https://raw.githubusercontent.com/denisseram/time-i-gram-datasets/65e773b/novelists';
const WRITERS = { type: 'csv-time', url: `${BASE}/writers.csv`, interval: ['birth', 'death'] };
const WORKS = { type: 'csv-time', url: `${BASE}/works.csv`, dateFields: ['published'] };

/** The writers by birth, as in `writers.csv`, after an empty row under the header. */
const NAMES = [
    'Jane Austen',
    'Mary Shelley',
    'Honoré de Balzac',
    'Charles Dickens',
    'Charlotte Brontë',
    'Emily Brontë',
    'Herman Melville',
    'George Eliot',
    'Fyodor Dostoyevsky',
    'Gustave Flaubert',
    'Jules Verne',
    'Leo Tolstoy',
    'Mark Twain',
    'Thomas Hardy',
    'Marcel Proust',
    'Thomas Mann',
    'Virginia Woolf',
    'James Joyce',
    'Franz Kafka',
    'F. Scott Fitzgerald',
    'William Faulkner',
    'Ernest Hemingway',
    'Gabriel García Márquez',
    'Toni Morrison'
];
const ROW = { field: 'writerLabel', type: 'nominal', domain: ['', ...NAMES] } as const;

const LIFE_COLOR = '#d9d4c7';
const WORK_COLOR = '#8c2d04';

/** Works: the dot size is the number of Wikipedias with an article about the work. */
const workMarks = {
    mark: 'point',
    color: { value: WORK_COLOR },
    size: { field: 'sitelinks', type: 'quantitative', domain: [30, 110], range: [2, 7] },
    opacity: { value: 0.85 },
    tooltip: [
        { field: 'workLabel', type: 'nominal', alt: 'Work' },
        { field: 'writerLabel', type: 'nominal', alt: 'Writer' },
        { field: 'published', type: 'temporal', alt: 'First published', format: '%Y' },
        { field: 'sitelinks', type: 'quantitative', alt: 'Wikipedias' }
    ]
};

/** Each writer's age: offsets from their own birth, in years. */
const AGE = {
    type: 'temporal',
    relative: { anchor: { field: 'birth' }, unit: 'year', label: 'birth' },
    domain: { interval: ['0 years', '90 years'] },
    linkingId: 'age'
} as const;

const spec = {
    title: 'When did each novelist publish their masterpieces, and at what age?',
    subtitle:
        'Lives (bars) and works with articles in 30+ Wikipedias (dots, larger: in more). Source: Wikidata (CC0), queried 15 October 2026',
    arrangement: 'vertical',
    spacing: 40,
    views: [
        {
            xDomain: { interval: ['1770', '2025'] },
            tracks: [
                {
                    title: 'Lives and first editions, by year',
                    alignment: 'overlay',
                    x: { field: 'birth', type: 'temporal', axis: 'bottom' },
                    row: ROW,
                    tracks: [
                        {
                            data: WRITERS,
                            mark: 'rect',
                            xe: { field: 'death', type: 'temporal' },
                            row: { ...ROW, legend: true },
                            color: { value: LIFE_COLOR },
                            tooltip: [
                                { field: 'writerLabel', type: 'nominal', alt: 'Writer' },
                                { field: 'birth', type: 'temporal', alt: 'Born' },
                                { field: 'death', type: 'temporal', alt: 'Died' }
                            ]
                        },
                        { ...workMarks, data: WORKS, x: { field: 'published', type: 'temporal', axis: 'bottom' } }
                    ],
                    width: 1300,
                    height: 500
                }
            ]
        },
        {
            arrangement: 'horizontal',
            spacing: 40,
            views: [
                {
                    layout: 'circular',
                    centerRadius: 0.3,
                    tracks: [
                        {
                            title: 'Ages, one ring per writer (outer: Austen)',
                            alignment: 'overlay',
                            x: { ...AGE, field: 'birth', axis: 'top', linkingId: undefined },
                            row: ROW,
                            tracks: [
                                {
                                    data: WRITERS,
                                    mark: 'rect',
                                    xe: { field: 'death', type: 'temporal' },
                                    color: { value: LIFE_COLOR }
                                },
                                {
                                    ...workMarks,
                                    data: WORKS,
                                    x: { ...AGE, field: 'published', axis: 'top', linkingId: undefined },
                                    size: { ...workMarks.size, range: [1, 4] }
                                },
                                {
                                    data: WRITERS,
                                    mark: 'brush',
                                    x: { linkingId: 'age' },
                                    color: { value: 'steelBlue' },
                                    opacity: { value: 0.15 }
                                }
                            ],
                            width: 460,
                            height: 200
                        }
                    ]
                },
                {
                    tracks: [
                        {
                            title: 'Ages: lives and first editions, aligned to each birth',
                            alignment: 'overlay',
                            x: { ...AGE, field: 'birth', axis: 'bottom', domain: { interval: ['15 years', '60 years'] } },
                            row: ROW,
                            tracks: [
                                {
                                    data: WRITERS,
                                    mark: 'rect',
                                    xe: { field: 'death', type: 'temporal' },
                                    row: { ...ROW, legend: true },
                                    color: { value: LIFE_COLOR }
                                },
                                {
                                    ...workMarks,
                                    data: WORKS,
                                    x: { ...AGE, field: 'published', axis: 'bottom', domain: { interval: ['15 years', '60 years'] } }
                                }
                            ],
                            width: 800,
                            height: 500
                        }
                    ]
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_NOVELISTS = spec as unknown as GoslingSpec;
