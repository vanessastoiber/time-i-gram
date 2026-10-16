import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// A reproduction of the Chro-Ring "time ring" (Zhu et al., 2016) for the life of the Song dynasty writer Su Shi
// (1036-1101), from the China Biographical Database (CBDB, release cbdb_20260530, CC BY-NC-SA 4.0): exports of his
// postings, dated social associations and examinations, made by SQL queries kept next to them in
// time-i-gram-datasets/cbdb-su-shi.
//
// - Top: the life bar. Each posting is a bar at the latitude of its place (Chro-Ring draws a map in the center of the
//   ring; the grammar has no geographic coordinates, so latitude stands in for it), red in the capital, blue in a
//   post of exile, grey elsewhere, with a line through the places he moved to. Labels only fit the longer postings;
//   every posting names itself in a tooltip.
// - Ring, from the outside in: his dated associations, one row per category (CBDB's top-level association types);
//   his postings with a place, as intervals (as points at their start when CBDB has no end year); titles and offices
//   without a place, as points. The associations are counted by year and category (the point's size).
// - CBDB gives years (sometimes months), so every date is a year or a month, as the queries document. Su Shi's 38
//   texts have no year and are not drawn.
// Su Shi lived before 1970: times are negative Unix seconds, which the temporal axis supports.

const BASE = 'https://raw.githubusercontent.com/denisseram/time-i-gram-datasets/4480f5f/cbdb-su-shi';
const POSTINGS = { type: 'csv-time', url: `${BASE}/postings.csv`, interval: ['start', 'end'] };
const ASSOCIATIONS = { type: 'csv-time', url: `${BASE}/associations.csv`, dateFields: ['date'] };
const ENTRIES = { type: 'csv-time', url: `${BASE}/entries.csv`, dateFields: ['date'] };

const LIFE = { interval: ['1036', '1102'] };
const x = (field: string, axis: 'top' | 'bottom' | 'none' = 'none') =>
    ({ field, type: 'temporal', domain: LIFE, axis } as const);
const xe = (field: string) => ({ field, type: 'temporal' } as const);

/** Offices of his exiles: vice military training commissioner, vice military commissioner, prefectural aide. */
const EXILE_OFFICES = ['團練副使', '節度副使', '州別駕'];
const CAPITAL = ['Kaifeng', 'Kaifeng Fu'];
const KINDS = [
    { label: 'In the capital (Kaifeng)', color: '#d6336c', filter: [{ type: 'filter', field: 'place', oneOf: CAPITAL }] },
    { label: 'In exile', color: '#3b7dd8', filter: [{ type: 'filter', field: 'office_chn', oneOf: EXILE_OFFICES }] },
    {
        label: 'Elsewhere',
        color: '#9a9a9a',
        filter: [
            { type: 'filter', field: 'place', oneOf: CAPITAL, not: true },
            { type: 'filter', field: 'office_chn', oneOf: EXILE_OFFICES, not: true }
        ]
    }
];
const WITH_PLACE = { type: 'filter', field: 'place', oneOf: ['[Unknown]', ''], not: true };
/** Postings with a place and an end (intervals). */
const PLACED = [WITH_PLACE, { type: 'filter', field: 'end', oneOf: [''], not: true }];
/** Postings with a place whose end CBDB does not know: drawn at their start only. */
const OPEN_ENDED = [WITH_PLACE, { type: 'filter', field: 'end', oneOf: [''] }];

const CATEGORIES = ['Writings', 'Scholarship', 'Politics', 'Friendship', 'Associations (General)'];
const CATEGORY_COLORS = ['#7b5ea7', '#3f88a8', '#c0507a', '#8c6d46', '#9a9a9a'];

const postingTooltip = [
    { field: 'place', type: 'nominal', alt: 'Place' },
    { field: 'office', type: 'nominal', alt: 'Office' },
    { field: 'office_chn', type: 'nominal', alt: 'Office (Chinese)' },
    { field: 'first_year', type: 'nominal', alt: 'From' },
    { field: 'last_year', type: 'nominal', alt: 'To (0: unknown)' }
];

/** Hide a label that is wider than its interval (from `x` to `xe`). */
const fitLabel = [
    { operation: 'less-than', measure: 'width', threshold: '|xe-x|', transitionPadding: 4, target: 'mark' }
];

const WIDTH = 900;
/** The ring's diameter: it fits a screen below the life bar. */
const RING = 620;
const LAT = { field: 'lat', type: 'quantitative', domain: [18, 41], axis: 'left', title: 'Latitude of the place (°N)' } as const;

const spec = {
    title: 'Where did Su Shi serve, and whom did he write for, year by year? (Chro-Ring, 1036-1101)',
    subtitle: 'Postings and dated associations of Su Shi. Source: China Biographical Database (CBDB 20260530, CC BY-NC-SA)',
    arrangement: 'vertical',
    spacing: 30,
    views: [
        {
            static: true,
            tracks: [
                {
                    title: 'Postings by the latitude of their place',
                    alignment: 'overlay',
                    data: POSTINGS,
                    x: x('start', 'bottom'),
                    y: LAT,
                    tracks: [
                        // the line through the places he moved to
                        {
                            mark: 'line',
                            dataTransform: [{ type: 'filter', field: 'place', oneOf: ['[Unknown]', ''], not: true }],
                            y: LAT,
                            color: { value: '#c8c8c8' },
                            size: { value: 1 }
                        },
                        ...KINDS.map((kind, i) => ({
                            mark: 'rect',
                            dataTransform: [...PLACED, ...kind.filter],
                            xe: xe('end'),
                            y: LAT,
                            color: { value: kind.color },
                            size: { value: 9 },
                            tooltip: postingTooltip,
                            style: { ...(i === 0 ? { legendTitle: 'Posted' } : {}), legendLabel: kind.label }
                        })),
                        ...KINDS.map(kind => ({
                            mark: 'point',
                            dataTransform: [...OPEN_ENDED, ...kind.filter],
                            y: LAT,
                            color: { value: kind.color },
                            size: { value: 5 },
                            tooltip: postingTooltip
                        })),
                        {
                            mark: 'text',
                            dataTransform: PLACED,
                            xe: xe('end'),
                            y: LAT,
                            text: { field: 'place', type: 'nominal' },
                            color: { value: '#333333' },
                            visibility: fitLabel,
                            style: { dy: -11, textFontSize: 9 }
                        }
                    ],
                    width: WIDTH,
                    height: 240
                },
                {
                    title: 'Examinations',
                    alignment: 'overlay',
                    data: ENTRIES,
                    x: x('date'),
                    // at two heights: the two examinations are four years apart
                    tracks: [
                        [1057, -6],
                        [1061, 8]
                    ].map(([year, dy]) => ({
                        mark: 'text',
                        dataTransform: [{ type: 'filter', field: 'year', oneOf: [String(year)] }],
                        text: { field: 'entry', type: 'nominal' },
                        color: { value: '#333333' },
                        style: { dy, textFontSize: 9 }
                    })),
                    width: WIDTH,
                    height: 50
                }
            ]
        },
        {
            layout: 'circular',
            static: true,
            centerRadius: 0.35,
            spacing: 2,
            tracks: [
                {
                    // CBDB dates 95 of the 100 dated associations to 1095
                    title: 'Associations by year (the larger, the more; CBDB dates 95 of 100 to 1095)',
                    data: ASSOCIATIONS,
                    mark: 'point',
                    // one point per year and category, sized by the number of associations
                    x: { ...x('date', 'top'), timeUnit: 'year' },
                    row: { field: 'category', type: 'nominal', domain: CATEGORIES },
                    color: {
                        field: 'category',
                        type: 'nominal',
                        domain: CATEGORIES,
                        range: CATEGORY_COLORS,
                        legend: true,
                        title: 'Association'
                    },
                    size: { field: 'year', type: 'quantitative', aggregate: 'count', domain: [1, 50], range: [3, 13] },
                    opacity: { value: 0.75 },
                    tooltip: [
                        { field: 'date', type: 'temporal', alt: 'Year', format: '%Y' },
                        { field: 'category', type: 'nominal', alt: 'Category' },
                        { field: 'year', type: 'quantitative', alt: 'Associations' }
                    ],
                    width: RING,
                    height: 130
                },
                {
                    title: 'Postings',
                    alignment: 'overlay',
                    data: POSTINGS,
                    x: x('start'),
                    tracks: [
                        ...KINDS.map(kind => ({
                            mark: 'rect',
                            dataTransform: [...PLACED, ...kind.filter],
                            xe: xe('end'),
                            color: { value: kind.color },
                            stroke: { value: 'white' },
                            strokeWidth: { value: 0.5 },
                            tooltip: postingTooltip
                        })),
                        ...KINDS.map(kind => ({
                            mark: 'point',
                            dataTransform: [...OPEN_ENDED, ...kind.filter],
                            color: { value: kind.color },
                            size: { value: 4 },
                            tooltip: postingTooltip
                        }))
                    ],
                    width: RING,
                    height: 26
                },
                {
                    title: 'Titles without a place',
                    data: POSTINGS,
                    dataTransform: [{ type: 'filter', field: 'place', oneOf: ['[Unknown]', ''] }],
                    mark: 'point',
                    x: x('start'),
                    color: { value: '#555555' },
                    size: { value: 3 },
                    tooltip: postingTooltip,
                    width: RING,
                    height: 20
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_CHRO_RING = spec as unknown as GoslingSpec;
