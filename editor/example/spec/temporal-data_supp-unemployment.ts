import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Supplementary material, Fig. S3 (U.S. Unemployment Across Industries; paper Fig. 4).
// Copied from the supplementary PDF and wrapped in a TS export. Fixed since: removed `genomicFields`,
// which is not a csv-time property and made the spec schema-invalid (docs/grammar-audit.md §7).

// the BLS series as published in vega-datasets (the supplementary material read a CSV copy of it)
const JSON_URL = 'https://raw.githubusercontent.com/vega/vega/main/docs/data/unemployment-across-industries.json';

const baseData = {
    type: 'json-time',
    url: JSON_URL,
    dateFields: ['date'],
    sampleLength: 2000
};

// January 2000 to February 2010, the extent of the data
const timeDomain = { interval: ['2000-01', '2010-02'] };
const industries = ['Government', 'Manufacturing', 'Construction', 'Information', 'Finance'];

const spec = {
    title: 'Which industries were hit hardest by the 2008 recession?',
    subtitle:
        'Unemployed persons (thousands) by industry and month, 2000 to 2010. Source: U.S. Bureau of Labor Statistics',
    arrangement: 'horizontal',
    views: [
        // -- LEFT: CIRCULAR OVERVIEW with BRUSH --
        {
            layout: 'circular',
            title: 'All industries (drag the brush)',
            // room for the axis title and the legend in the center
            centerRadius: 0.5,
            alignment: 'overlay',
            width: 450,
            height: 450,
            tracks: [
                ...industries.map((s, i) => ({
                    data: { ...baseData },
                    dataTransform: [{ type: 'filter', field: 'series', oneOf: [s] }],
                    x: {
                        field: 'date',
                        type: 'temporal',
                        axis: 'top',
                        domain: timeDomain
                    },
                    y: {
                        field: 'count',
                        type: 'quantitative',
                        axis: 'right',
                        // the radial axis is shared: one title, in the center
                        ...(i === 0 ? { title: 'Unemployed (thousands)' } : {})
                    },
                    color: {
                        field: 'series',
                        type: 'nominal',
                        domain: industries,
                        // one legend for the five overlaid rings, in the center of the ring
                        legend: i === 0,
                        title: 'Industry'
                    },
                    mark: 'line',
                    width: 450,
                    height: 450,
                    style: { outline: 'none' }
                })),
                {
                    mark: 'brush',
                    x: { linkingId: 'detail-link' },
                    color: { value: 'steelBlue' }
                }
            ]
        },
        // -- RIGHT: DETAIL PANELS stacked vertically --
        {
            arrangement: 'vertical',
            views: [
                // Detail panel 1: Public & Industrial
                {
                    title: 'Public and industrial sectors',
                    alignment: 'overlay',
                    width: 500,
                    height: 170,
                    tracks: ['Government', 'Manufacturing', 'Construction'].flatMap(s => [
                        {
                            data: { ...baseData },
                            dataTransform: [{ type: 'filter', field: 'series', oneOf: [s] }],
                            x: {
                                field: 'date',
                                type: 'temporal',
                                axis: 'bottom',
                                domain: timeDomain,
                                linkingId: 'detail-link'
                            },
                            y: {
                                field: 'count',
                                type: 'quantitative',
                                axis: 'left'
                            },
                            color: {
                                field: 'series',
                                type: 'nominal',
                                domain: industries
                            },
                            mark: 'area',
                            // faint: overlaid areas mix their colors, which then differ from the legend
                            opacity: { value: 0.12 },
                            width: 500,
                            height: 170,
                            style: { outline: 'none' }
                        },
                        {
                            data: { ...baseData },
                            dataTransform: [{ type: 'filter', field: 'series', oneOf: [s] }],
                            x: {
                                field: 'date',
                                type: 'temporal',
                                axis: 'bottom',
                                domain: timeDomain,
                                linkingId: 'detail-link'
                            },
                            y: {
                                field: 'count',
                                type: 'quantitative',
                                axis: 'left',
                                title: 'Unemployed (thousands)'
                            },
                            color: {
                                field: 'series',
                                type: 'nominal',
                                domain: industries,
                                legend: true,
                                title: 'Industry'
                            },
                            mark: 'line',
                            size: { value: 1.5 },
                            width: 500,
                            height: 170,
                            style: { outline: 'none' }
                        }
                    ])
                },
                // Detail panel 2: Service & Knowledge
                {
                    title: 'Service and knowledge sectors',
                    alignment: 'overlay',
                    width: 500,
                    height: 170,
                    tracks: ['Information', 'Finance'].flatMap(s => [
                        {
                            data: { ...baseData },
                            dataTransform: [{ type: 'filter', field: 'series', oneOf: [s] }],
                            x: {
                                field: 'date',
                                type: 'temporal',
                                axis: 'bottom',
                                domain: timeDomain,
                                linkingId: 'detail-link'
                            },
                            y: {
                                field: 'count',
                                type: 'quantitative',
                                axis: 'left'
                            },
                            color: {
                                field: 'series',
                                type: 'nominal',
                                domain: industries
                            },
                            mark: 'area',
                            // faint: overlaid areas mix their colors, which then differ from the legend
                            opacity: { value: 0.12 },
                            width: 500,
                            height: 170,
                            style: { outline: 'none' }
                        },
                        {
                            data: { ...baseData },
                            dataTransform: [{ type: 'filter', field: 'series', oneOf: [s] }],
                            x: {
                                field: 'date',
                                type: 'temporal',
                                axis: 'bottom',
                                domain: timeDomain,
                                linkingId: 'detail-link'
                            },
                            y: {
                                field: 'count',
                                type: 'quantitative',
                                axis: 'left',
                                title: 'Unemployed (thousands)'
                            },
                            color: {
                                field: 'series',
                                type: 'nominal',
                                domain: industries,
                                legend: true,
                                title: 'Industry'
                            },
                            mark: 'line',
                            size: { value: 1.5 },
                            width: 500,
                            height: 170,
                            style: { outline: 'none' }
                        }
                    ])
                },
                // Timeline overview with brush
                {
                    title: 'All industries (drag to select a period)',
                    alignment: 'overlay',
                    width: 500,
                    height: 60,
                    tracks: [
                        {
                            data: { ...baseData },
                            x: {
                                field: 'date',
                                type: 'temporal',
                                axis: 'bottom',
                                domain: timeDomain
                            },
                            y: {
                                field: 'count',
                                type: 'quantitative',
                                axis: 'none'
                            },
                            color: { value: '#94a3b8' },
                            mark: 'bar',
                            width: 500,
                            height: 60,
                            style: { outline: 'none' }
                        },
                        {
                            mark: 'brush',
                            x: { linkingId: 'detail-link' },
                            color: { value: 'steelBlue' }
                        }
                    ]
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_SUPP_UNEMPLOYMENT = spec as unknown as GoslingSpec;
