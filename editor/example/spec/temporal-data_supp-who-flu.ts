import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Supplementary material, Fig. S7 (WHO Flu Data; paper Fig. 1A).
// Copied from the supplementary PDF (a fragment, wrapped in a root object). Fixed since
// (docs/grammar-audit.md §7): the circular view shows one year (2010), as in the published figure,
// instead of the root domain (2009-09 to 2012-04), and the two comparison views, which had no data,
// read the superimposed file.
//
// `who_flu_usa_superimposed` is `who_flu_usa.csv` with the year of every ISO_SDATE set to 2010
// (ISO_YEAR keeps the real year), which is what stacks the seasons on one ring. It was made by hand,
// and ISO week 1 of 2013, 2014 and 2015 starts in late December, so those points sit at the end of
// the ring instead of the start. Left as is on purpose: a period-based cyclic layout should replace
// this preprocessing.

const SUPERIMPOSED_DATA = {
    url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/5_who-flu/who_flu_usa_superimposed',
    type: 'csv-time',
    dateFields: ['ISO_SDATE']
};

const spec = {
    xDomain: { interval: [1251763200, 1333238400] },

    arrangement: 'vertical',
    spacing: 0,

    views: [
        {
            // --- Circular overview: highlights seasonal (cyclic) patterns ---
            spacing: 0,
            layout: 'circular',
            alignment: 'stack',
            // one ring per year: the superimposed data covers 2010 only
            xDomain: { interval: [1262304000, 1293840000] },

            data: SUPERIMPOSED_DATA,

            tracks: [
                {
                    mark: 'line',
                    size: { value: 2.5 },

                    // Color encodes year for comparison across cycles
                    color: {
                        field: 'ISO_YEAR',
                        type: 'nominal',
                        legend: true,
                        domain: ['2010', '2011', '2012', '2013', '2014'],
                        range: ['#C635BB', '#E5C011', '#12C340', '#1279C3', '#CC2F06']
                    },

                    x: { field: 'ISO_SDATE', type: 'temporal', axis: 'top' },
                    y: { field: 'INF_A', type: 'quantitative', domain: [0, 15000] },

                    style: { outlineWidth: 0 },
                    width: 400,
                    height: 100
                }
            ]
        },

        {
            // --- Linear comparison views: support direct year-to-year comparison ---
            spacing: 0,
            arrangement: 'horizontal',

            views: [
                {
                    tracks: [
                        {
                            data: SUPERIMPOSED_DATA,
                            mark: 'line',
                            size: { value: 2.5 },

                            color: {
                                field: 'ISO_YEAR',
                                type: 'nominal',
                                domain: ['2010', '2011', '2012', '2013', '2014'],
                                range: ['#C635BB', '#E5C011', '#12C340', '#1279C3', '#CC2F06']
                            },

                            x: { field: 'ISO_SDATE', type: 'temporal', axis: 'bottom' },
                            y: {
                                field: 'INF_A',
                                type: 'quantitative',
                                domain: [0, 10000]
                            },

                            width: 300
                        }
                    ]
                },
                {
                    tracks: [
                        {
                            data: SUPERIMPOSED_DATA,
                            mark: 'line',
                            size: { value: 2.5 },

                            // Legend shown only once to reduce redundancy
                            color: {
                                field: 'ISO_YEAR',
                                type: 'nominal',
                                legend: true,
                                domain: ['2010', '2011', '2012', '2013', '2014'],
                                range: ['#C635BB', '#E5C011', '#12C340', '#1279C3', '#CC2F06']
                            },

                            x: { field: 'ISO_SDATE', type: 'temporal', axis: 'bottom' },
                            y: {
                                field: 'INF_A',
                                type: 'quantitative',
                                domain: [0, 10000],
                                axis: 'none'
                            },

                            width: 300
                        }
                    ]
                }
            ]
        },

        {
            // --- Timeline overview: provides global temporal context ---
            alignment: 'overlay',
            width: 600,
            height: 110,

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/5_who-flu/who_flu_usa.csv',
                type: 'csv-time',
                dateFields: ['ISO_SDATE']
            },

            tracks: [
                {
                    // Aggregate flu cases over time
                    mark: 'bar',
                    color: { value: 'black' },
                    size: { value: 5 },

                    x: { field: 'ISO_SDATE', type: 'temporal', axis: 'bottom' },
                    y: { field: 'INF_A', type: 'quantitative', domain: [0, 8000] },

                    width: 400,
                    height: 110
                },

                {
                    // Highlight yearly intervals (week 1 as anchor)
                    mark: 'rect',
                    dataTransform: [
                        { type: 'filter', field: 'ISO_WEEK', oneOf: ['1'] },
                        {
                            type: 'interval',
                            field: 'ISO_YEAR',
                            yearField: 'ISO_YEAR',
                            weekField: 'ISO_WEEK',
                            transformedDateField: 'ISO_SDATE',
                            newField: 'NEXT_YEAR'
                        }
                    ],

                    color: {
                        field: 'ISO_YEAR',
                        type: 'nominal',
                        domain: ['2010', '2011', '2012', '2013', '2014'],
                        range: ['#C635BB', '#E5C011', '#12C340', '#1279C3', '#CC2F06']
                    },

                    x: { field: 'ISO_SDATE', type: 'temporal' },
                    xe: { field: 'NEXT_YEAR', type: 'temporal' },

                    y: { value: 100 },
                    size: { value: 15 }
                },

                {
                    // Year labels
                    dataTransform: [
                        { type: 'filter', field: 'ISO_WEEK', oneOf: ['1'] },
                        {
                            type: 'interval',
                            field: 'ISO_YEAR',
                            yearField: 'ISO_YEAR',
                            weekField: 'ISO_WEEK',
                            transformedDateField: 'ISO_SDATE',
                            newField: 'NEXT_YEAR'
                        },
                        {
                            type: 'filter',
                            field: 'ISO_YEAR',
                            oneOf: ['2015'],
                            not: true
                        }
                    ],

                    mark: 'text',
                    text: { field: 'ISO_YEAR', type: 'nominal' },
                    color: { value: 'white' },

                    x: { field: 'ISO_SDATE', type: 'temporal' },
                    xe: { field: 'NEXT_YEAR', type: 'temporal' },

                    size: { value: 15 },
                    style: { textFontSize: 5, dy: 45 }
                },

                {
                    // Year boundary lines
                    dataTransform: [
                        { type: 'filter', field: 'ISO_WEEK', oneOf: ['1'] },
                        {
                            type: 'interval',
                            field: 'ISO_YEAR',
                            yearField: 'ISO_YEAR',
                            weekField: 'ISO_WEEK',
                            transformedDateField: 'ISO_SDATE',
                            newField: 'NEXT_YEAR'
                        },
                        {
                            type: 'filter',
                            field: 'ISO_YEAR',
                            oneOf: ['2015'],
                            not: true
                        }
                    ],

                    mark: 'rule',
                    color: { value: 'lightgray' },

                    x: { field: 'ISO_SDATE', type: 'temporal' },
                    strokeWidth: { value: 1 }
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_SUPP_WHO_FLU = spec as unknown as GoslingSpec;
