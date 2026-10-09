import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// The relative time coordinate system: `x.relative` re-expresses time as a signed offset from a reference
// event, and the axis labels offsets ("-4 wk", "0", "+8 wk") instead of dates.
//
// Top: flu seasons aligned to their own peak. Each season runs from ISO week 40 to week 39
// (`groupby: { period: ... }`), the anchor is the season's largest weekly count (`argmax`), and the
// season of each row is stored in the field `season` for the color. The data ends at 2015-W01, so the
// 2014/15 season is incomplete and its anchor is its largest count so far.
// Bottom: unemployment by industry aligned to a fixed event, the collapse of Lehman Brothers.
// Both views are relative, but measure from different events, so they are not linked.

const FLU = {
    url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/5_who-flu/who_flu_usa.csv',
    type: 'csv-time',
    // the Monday of each ISO week is stored in the first field (see the period example)
    dateFields: ['ISO_YEAR', 'ISO_WEEK'],
    includesCalendarWeek: true
} as const;

const UNEMPLOYMENT = {
    type: 'csv-time',
    url: 'https://raw.githubusercontent.com/denisseram/time-i-gram/14a22f2e66006df8a8498e2c0d6f992c5b49a810/unemployment-across-industries.csv',
    dateFields: ['date']
} as const;

const SERIES = ['Construction', 'Manufacturing', 'Finance', 'Information', 'Education and Health'];

const spec = {
    title: 'Do flu seasons, and industries after the 2008 crash, follow the same course?',
    subtitle: 'Top: each flu season aligned to its peak week. Bottom: unemployment aligned to 15 September 2008.',
    arrangement: 'vertical',
    views: [
        {
            tracks: [
                {
                    title: 'Influenza A, aligned to the peak of each season',
                    alignment: 'overlay',
                    data: FLU,
                    x: {
                        field: 'ISO_YEAR',
                        type: 'temporal',
                        relative: {
                            anchor: { argmax: 'INF_A' },
                            groupby: { period: { unit: 'year', weekBased: true, start: 40, newField: 'season' } },
                            unit: 'week',
                            label: "the season's peak"
                        },
                        domain: { interval: ['-16 weeks', '16 weeks'] },
                        axis: 'bottom'
                    },
                    y: {
                        field: 'INF_A',
                        type: 'quantitative',
                        domain: [0, 14000],
                        axis: 'left',
                        title: 'Cases per week'
                    },
                    color: {
                        field: 'season',
                        type: 'nominal',
                        domain: ['2009/10', '2010/11', '2011/12', '2012/13', '2013/14', '2014/15'],
                        legend: true,
                        title: 'Season'
                    },
                    tracks: [
                        { mark: 'line', size: { value: 2 } },
                        { mark: 'point', size: { value: 3 } }
                    ],
                    width: 800,
                    height: 220
                }
            ]
        },
        {
            tracks: [
                {
                    title: 'Unemployment rate, aligned to the collapse of Lehman Brothers',
                    alignment: 'overlay',
                    data: UNEMPLOYMENT,
                    dataTransform: [{ type: 'filter', field: 'series', oneOf: SERIES }],
                    x: {
                        field: 'date',
                        type: 'temporal',
                        relative: { anchor: '2008-09-15', unit: 'month', label: 'the collapse of Lehman Brothers' },
                        domain: { interval: ['-36 months', '18 months'] },
                        axis: 'bottom'
                    },
                    y: {
                        field: 'rate',
                        type: 'quantitative',
                        domain: [0, 30],
                        axis: 'left',
                        title: 'Unemployment rate (%)'
                    },
                    color: { field: 'series', type: 'nominal', domain: SERIES, legend: true, title: 'Industry' },
                    tracks: [{ mark: 'line', size: { value: 2 } }],
                    width: 800,
                    height: 200
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_RELATIVE_ALIGNMENT = spec as unknown as GoslingSpec;
