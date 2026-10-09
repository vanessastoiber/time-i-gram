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
// this preprocessing (see the period example).
// Since fixed: the two linear views show the end and the start of the season instead of the same range, the
// timeline covers all years, and every view has titles, axis titles and a year legend.

const SUPERIMPOSED_DATA = {
    url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/5_who-flu/who_flu_usa_superimposed',
    type: 'csv-time',
    dateFields: ['ISO_SDATE']
};

const YEARS = {
    field: 'ISO_YEAR',
    type: 'nominal',
    domain: ['2010', '2011', '2012', '2013', '2014'],
    range: ['#C635BB', '#E5C011', '#12C340', '#1279C3', '#CC2F06'],
    title: 'Year'
} as const;

const spec = {
    title: 'Does the flu season peak at the same time every year?',
    subtitle: 'Weekly influenza A cases in the USA, 2010 to 2014, with every year drawn over 2010',
    xDomain: { interval: [1251763200, 1333238400] },

    arrangement: 'vertical',
    spacing: 20,

    views: [
        {
            // --- Circular overview: highlights seasonal (cyclic) patterns ---
            spacing: 0,
            layout: 'circular',
            alignment: 'stack',
            centerRadius: 0.45,
            // one ring per year: the superimposed data covers 2010 only
            xDomain: { interval: [1262304000, 1293840000] },

            data: SUPERIMPOSED_DATA,

            tracks: [
                {
                    mark: 'line',
                    size: { value: 2.5 },

                    // Color encodes year for comparison across cycles
                    color: { ...YEARS, legend: true },

                    x: { field: 'ISO_SDATE', type: 'temporal', axis: 'top' },
                    y: { field: 'INF_A', type: 'quantitative', domain: [0, 15000], title: 'Cases per week' },

                    style: { outlineWidth: 0 },
                    width: 400,
                    height: 100
                }
            ]
        },

        {
            // --- Linear comparison views: support direct year-to-year comparison ---
            spacing: 30,
            arrangement: 'horizontal',

            // the two halves of the season: its end (January to May) and its start (September to December)
            views: [
                {
                    xDomain: { interval: ['2010-01', '2010-05'] },
                    tracks: [
                        {
                            title: 'End of the season',
                            data: SUPERIMPOSED_DATA,
                            mark: 'line',
                            size: { value: 2.5 },

                            color: YEARS,

                            x: { field: 'ISO_SDATE', type: 'temporal', axis: 'bottom' },
                            y: {
                                field: 'INF_A',
                                type: 'quantitative',
                                domain: [0, 10000],
                                title: 'Cases per week'
                            },

                            width: 300,
                            height: 150
                        }
                    ]
                },
                {
                    xDomain: { interval: ['2010-09', '2010-12'] },
                    tracks: [
                        {
                            title: 'Start of the season',
                            data: SUPERIMPOSED_DATA,
                            mark: 'line',
                            size: { value: 2.5 },

                            // the legend of these colors is in the center of the ring
                            color: YEARS,

                            x: { field: 'ISO_SDATE', type: 'temporal', axis: 'bottom' },
                            y: {
                                field: 'INF_A',
                                type: 'quantitative',
                                domain: [0, 10000],
                                title: 'Cases per week'
                            },

                            width: 300,
                            height: 150
                        }
                    ]
                }
            ]
        },

        {
            // --- Timeline overview: provides global temporal context ---
            alignment: 'overlay',
            title: 'All weeks, 2010 to 2014',
            width: 600,
            height: 130,
            // the whole timeline, so that every year's band is visible
            xDomain: { interval: ['2010', '2014'] },

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/5_who-flu/who_flu_usa.csv',
                type: 'csv-time',
                dateFields: ['ISO_SDATE']
            },

            tracks: [
                {
                    // Weekly flu cases over time, colored by year as in the ring (the published figure drew
                    // colored year bands with labels above the bars instead)
                    mark: 'bar',
                    color: { ...YEARS, legend: true },
                    size: { value: 5 },

                    x: { field: 'ISO_SDATE', type: 'temporal', axis: 'bottom' },
                    y: { field: 'INF_A', type: 'quantitative', domain: [0, 14000], title: 'Cases per week' },

                    width: 400,
                    height: 130
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_SUPP_WHO_FLU = spec as unknown as GoslingSpec;
