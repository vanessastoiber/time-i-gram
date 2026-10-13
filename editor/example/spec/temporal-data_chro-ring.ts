import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// A reproduction of the Chro-Ring "time ring" (Zhu et al., 2016) for the life of the Song dynasty writer Su Shi
// (1037-1101), with simulated data loosely based on his biography: the posts and their dates are approximate, and the
// life events and yearly writing counts are generated.
//
// - Top: the life bar. Each post is a bar at the height of its rank, labeled with its place; lines join consecutive
//   posts, red for a promotion and blue for a demotion or exile.
// - Ring, from the outside in: life events in four rows (the dot size is the event's weight), a faint spoke at every
//   move; poems written per year (outward) and prose (inward); the phases of his career (red: successful, blue:
//   setbacks); and the rank of his post, growing inward.
// - Chro-Ring draws a map of the places in the center of the ring. The grammar has no geographic coordinates, so the
//   center stays empty.
//
// Su Shi lived before 1970: times are negative Unix seconds, which the temporal axis supports (years 1 to 9999).

/** Posts: place, start and end (approximate), rank (0: home or exile, 4: high office in the capital). */
const POSTS: [string, string, string, number][] = [
    ['Meishan', '1037-01-08', '1056-03-01', 0],
    ['Kaifeng', '1056-05-01', '1057-05-01', 3],
    ['Meishan', '1057-06-01', '1059-10-01', 0],
    ['Kaifeng', '1060-02-01', '1061-11-01', 3],
    ['Fengxiang', '1061-12-01', '1065-01-01', 1],
    ['Kaifeng', '1065-02-01', '1066-05-01', 3],
    ['Meishan', '1066-06-01', '1068-12-01', 0],
    ['Kaifeng', '1069-02-01', '1071-07-01', 3],
    ['Hangzhou', '1071-11-01', '1074-09-01', 1],
    ['Mizhou', '1074-12-01', '1077-02-01', 2],
    ['Xuzhou', '1077-04-01', '1079-03-01', 2],
    ['Huzhou', '1079-04-01', '1079-08-01', 2],
    ['Huangzhou', '1080-02-01', '1084-04-01', 0],
    ['Ruzhou', '1084-05-01', '1085-06-01', 1],
    ['Dengzhou', '1085-10-01', '1085-12-01', 2],
    ['Kaifeng', '1086-01-01', '1089-03-01', 4],
    ['Hangzhou', '1089-07-01', '1091-03-01', 2],
    ['Kaifeng', '1091-05-01', '1091-08-01', 4],
    ['Yingzhou', '1091-08-01', '1092-02-01', 2],
    ['Yangzhou', '1092-03-01', '1092-08-01', 2],
    ['Kaifeng', '1092-09-01', '1093-09-01', 4],
    ['Dingzhou', '1093-10-01', '1094-04-01', 2],
    ['Huizhou', '1094-10-01', '1097-04-01', 0],
    ['Danzhou', '1097-07-01', '1100-06-01', 0],
    ['Changzhou', '1100-07-01', '1101-08-24', 1]
];

/** Phases of his career: name, start, end, outcome. */
const PHASES: [string, string, string, string][] = [
    ['Youth in Meishan', '1037-01-08', '1056-03-01', 'Youth'],
    ['Early success', '1056-03-01', '1069-02-01', 'Successful'],
    ['Against the reforms', '1069-02-01', '1079-08-01', 'Setback'],
    ['Trial, exile', '1079-08-01', '1085-10-01', 'Setback'],
    ['Restored', '1085-10-01', '1093-10-01', 'Successful'],
    ['Exiled again', '1093-10-01', '1101-08-24', 'Setback']
];

const OUTCOMES = ['Successful', 'Setback', 'Youth'];
const OUTCOME_COLORS = ['#d6336c', '#3b7dd8', '#c9c9c9'];
const RANK_COLOR = '#5aa5a5';
const CATEGORIES = ['Literary life', 'Achievements in office', 'Official career', 'Relationships'];
const CATEGORY_COLORS = ['#7b5ea7', '#3f88a8', '#c0507a', '#8c6d46'];

/** A deterministic pseudo-random generator, so that the simulated data are the same at every load. */
function random(seed: number) {
    return () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };
}

/** Rank of the post held in a year (the last post that started in or before it). */
function rankIn(year: number) {
    const post = [...POSTS].reverse().find(p => +p[1].slice(0, 4) <= year) ?? POSTS[0];
    return post[3];
}

/** Simulated works per year: more poems in exile and in Hangzhou, more prose in office in the capital. */
function works() {
    const r = random(7);
    const rows = [];
    for (let year = 1052; year <= 1101; year++) {
        const rank = rankIn(year);
        const place = [...POSTS].reverse().find(p => +p[1].slice(0, 4) <= year)?.[0];
        const exile = rank === 0 && year > 1070;
        const poems = Math.round(
            (exile ? 70 : place === 'Hangzhou' ? 80 : 30 + 8 * (year > 1070 ? 1 : 0)) * (0.5 + r())
        );
        const prose = Math.round((rank >= 3 ? 40 : 15) * (0.4 + r()));
        rows.push({ date: `${year}-07-01`, poems, prose });
    }
    return rows;
}

/** Simulated life events: one to four per year in random rows, with a weight from 1 to 5. */
function events() {
    const r = random(11);
    const rows = [];
    for (let year = 1050; year <= 1101; year++) {
        const n = 1 + Math.floor(r() * 4);
        for (let i = 0; i < n; i++) {
            const month = 1 + Math.floor(r() * 12);
            rows.push({
                date: `${year}-${String(month).padStart(2, '0')}-15`,
                category: CATEGORIES[Math.floor(r() * CATEGORIES.length)],
                weight: 1 + Math.floor(r() ** 3 * 5)
            });
        }
    }
    // a few events that matter more, as in the original
    rows.push({ date: '1057-03-01', category: 'Official career', weight: 9 }); // passes the palace examination
    rows.push({ date: '1079-08-18', category: 'Official career', weight: 10 }); // arrested: the Crow Terrace case
    rows.push({ date: '1082-07-16', category: 'Literary life', weight: 9 }); // the Red Cliff rhapsodies
    rows.push({ date: '1086-09-01', category: 'Achievements in office', weight: 8 }); // Hanlin academician
    rows.push({ date: '1090-04-01', category: 'Achievements in office', weight: 8 }); // the Su causeway in Hangzhou
    rows.push({ date: '1065-05-28', category: 'Relationships', weight: 8 }); // death of his wife Wang Fu
    return rows;
}

/** Lines between consecutive posts: two points each, from the end of one post to the start of the next. */
function moves() {
    const rows = [];
    for (let i = 1; i < POSTS.length; i++) {
        const [, , end, from] = POSTS[i - 1];
        const [, start, , to] = POSTS[i];
        const id = `move ${i}`;
        rows.push({ id, date: end, rank: from }, { id, date: start, rank: to });
    }
    return rows;
}
const MOVES = moves();
const MOVE_IDS = [...new Set(MOVES.map(m => m.id))];
const MOVE_COLORS = MOVE_IDS.map((_, i) => {
    const change = POSTS[i + 1][3] - POSTS[i][3];
    return change > 0 ? OUTCOME_COLORS[0] : change < 0 ? OUTCOME_COLORS[1] : '#999999';
});

// The data fetchers convert the dates of inline values in place: every track gets its own copy. `dateFields` with
// several fields reads them as date components (year, month, ...), so only the start is parsed and the end is given
// in Unix seconds.
const toSeconds = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 1000;
const posts = () => ({
    type: 'json-time' as const,
    dateFields: ['start'],
    values: POSTS.map(([place, start, end, rank], i) => ({
        place,
        start,
        end: toSeconds(end),
        rank,
        side: i % 2 ? 'above' : 'below'
    }))
});
const phases = () => ({
    type: 'json-time' as const,
    dateFields: ['start'],
    values: PHASES.map(([phase, start, end, outcome]) => ({ phase, start, end: toSeconds(end), outcome }))
});
const json = (values: object[]) => ({
    type: 'json-time' as const,
    dateFields: ['date'],
    values: values.map(v => ({ ...v }))
});

const LIFE = { interval: ['1036-07', '1102-06'] };
const x = (field: string, axis: 'top' | 'bottom' | 'none' = 'none') =>
    ({ field, type: 'temporal', domain: LIFE, axis } as const);
const xe = (field: string) => ({ field, type: 'temporal' } as const);
const outcomeColor = { field: 'outcome', type: 'nominal', domain: OUTCOMES, range: OUTCOME_COLORS } as const;
const rankY = { field: 'rank', type: 'quantitative', domain: [-0.7, 4.9], axis: 'none' } as const;
/** Hide a label that is wider than its interval (from `x` to `xe`). */
const fitLabel = [
    { operation: 'less-than', measure: 'width', threshold: '|xe-x|', transitionPadding: 4, target: 'mark' }
];

const WIDTH = 900;

/** Career phases: colored intervals labeled in white. */
function phaseTrack(axis: 'top' | 'none', height: number) {
    return {
        alignment: 'overlay',
        data: phases(),
        x: x('start', axis),
        xe: xe('end'),
        tracks: [
            { mark: 'rect', color: outcomeColor, stroke: { value: 'white' }, strokeWidth: { value: 1 } },
            {
                mark: 'text',
                text: { field: 'phase', type: 'nominal' },
                color: { value: 'white' },
                visibility: fitLabel,
                style: { textFontSize: 10, textFontWeight: 'bold' }
            }
        ],
        width: WIDTH,
        height
    };
}

const spec = {
    title: 'Chro-Ring: the life of Su Shi (1037-1101)',
    subtitle: 'After Zhu et al. (2016), with simulated data. Red: successful periods and promotions; blue: setbacks.',
    arrangement: 'vertical',
    spacing: 30,
    views: [
        {
            static: true,
            spacing: 0,
            tracks: [
                phaseTrack('none', 22),
                {
                    title: 'Posts by rank',
                    alignment: 'overlay',
                    data: posts(),
                    x: x('start', 'bottom'),
                    xe: xe('end'),
                    y: rankY,
                    // the overlaid tracks do not inherit `y` from this track: each sets it
                    tracks: [
                        {
                            data: json(MOVES),
                            mark: 'line',
                            x: x('date', 'bottom'),
                            xe: undefined, // the moves have no end
                            y: rankY,
                            color: { field: 'id', type: 'nominal', domain: MOVE_IDS, range: MOVE_COLORS },
                            size: { value: 1.5 }
                        },
                        { mark: 'rect', y: rankY, color: { value: '#9a9a9a' }, size: { value: 9 } },
                        // labels alternate below and above the bars, so that the short posts do not overlap
                        ...[
                            ['below', -12],
                            ['above', 12]
                        ].map(([side, dy]) => ({
                            mark: 'text',
                            dataTransform: [{ type: 'filter', field: 'side', oneOf: [side] }],
                            y: rankY,
                            text: { field: 'place', type: 'nominal' },
                            color: { value: '#333333' },
                            style: { dy, textFontSize: 9 }
                        }))
                    ],
                    width: WIDTH,
                    height: 170
                }
            ]
        },
        {
            layout: 'circular',
            static: true,
            centerRadius: 0.3,
            spacing: 2,
            tracks: [
                {
                    title: 'Events',
                    alignment: 'overlay',
                    tracks: [
                        {
                            // a spoke at every move
                            data: posts(),
                            mark: 'rect',
                            dataTransform: [{ type: 'span', field: 'start', duration: '1 month', newField: 'spoke' }],
                            x: x('start', 'top'),
                            xe: xe('spoke'),
                            color: { value: '#a9d3e6' }
                        },
                        {
                            data: json(events()),
                            mark: 'point',
                            x: x('date', 'top'),
                            row: { field: 'category', type: 'nominal', domain: CATEGORIES },
                            color: {
                                field: 'category',
                                type: 'nominal',
                                domain: CATEGORIES,
                                range: CATEGORY_COLORS,
                                legend: true
                            },
                            size: { field: 'weight', type: 'quantitative', domain: [1, 10], range: [2, 11] },
                            opacity: { value: 0.75 }
                        }
                    ],
                    width: WIDTH,
                    height: 120
                },
                {
                    title: 'Poems per year',
                    data: json(works()),
                    mark: 'bar',
                    x: { ...x('date'), timeUnit: 'year' },
                    y: { field: 'poems', type: 'quantitative', domain: [0, 130], axis: 'none' },
                    color: { value: '#555555' },
                    width: WIDTH,
                    height: 40
                },
                {
                    title: 'Prose per year',
                    data: json(works()),
                    mark: 'bar',
                    x: { ...x('date'), timeUnit: 'year' },
                    y: { field: 'prose', type: 'quantitative', domain: [0, 70], axis: 'none', flip: true },
                    color: { value: '#999999' },
                    width: WIDTH,
                    height: 30
                },
                { title: 'Career phases', ...phaseTrack('none', 22) },
                {
                    title: 'Rank',
                    data: posts(),
                    mark: 'bar',
                    x: x('start'),
                    xe: xe('end'),
                    y: { field: 'rank', type: 'quantitative', domain: [0, 4], axis: 'none', flip: true },
                    color: { value: RANK_COLOR },
                    width: WIDTH,
                    height: 60
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_CHRO_RING = spec as unknown as GoslingSpec;
