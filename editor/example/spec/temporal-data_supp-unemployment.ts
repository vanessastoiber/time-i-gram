import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Supplementary material, Fig. S3 (U.S. Unemployment Across Industries; paper Fig. 4).
// Copied verbatim from the supplementary PDF; only wrapped in a TS export.
// Not yet fixed: see docs/grammar-audit.md §7.

const CSV_URL =
    'https://raw.githubusercontent.com/denisseram/time-i-gram/14a22f2e66006df8a8498e2c0d6f992c5b49a810/unemployment-across-industries.csv';

const baseData = {
    type: 'csv-time',
    url: CSV_URL,
    separator: ',',
    dateFields: ['date'],
    sampleLength: 2000,
    genomicFields: ['date']
};

const timeDomain = { interval: [946713600, 1293782400] };
const industries = ['Government', 'Manufacturing', 'Construction', 'Information', 'Finance'];

const spec = {
    title: 'U.S. Unemployment Across Industries (2000 to 2010)',
    subtitle: 'Monthly number of unemployed persons by industry sector - Source: U.S. Bureau of Labor Statistics (BLS)',
    arrangement: 'horizontal',
    views: [
        // -- LEFT: CIRCULAR OVERVIEW with BRUSH --
        {
            layout: 'circular',
            title: 'Cyclical Unemployment Patterns',
            subtitle:
                'Each ring shows the monthly unemployment count for one industry - drag the brush to zoom into a period',
            centerRadius: 0.35,
            alignment: 'overlay',
            width: 450,
            height: 450,
            tracks: [
                ...industries.map(s => ({
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
                        axis: 'right'
                    },
                    color: {
                        field: 'series',
                        type: 'nominal',
                        domain: industries,
                        legend: true
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
                    title: 'Public & Industrial Sectors',
                    subtitle: 'Monthly unemployed persons (thousands) in Government, Manufacturing, and Construction',
                    alignment: 'overlay',
                    width: 500,
                    height: 130,
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
                            opacity: { value: 0.3 },
                            width: 500,
                            height: 130,
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
                                axis: 'left'
                            },
                            color: {
                                field: 'series',
                                type: 'nominal',
                                domain: industries
                            },
                            mark: 'line',
                            size: { value: 1.5 },
                            width: 500,
                            height: 130,
                            style: { outline: 'none' }
                        }
                    ])
                },
                // Detail panel 2: Service & Knowledge
                {
                    title: 'Service & Knowledge Sectors',
                    subtitle: 'Monthly unemployed persons (thousands) in Information and Finance',
                    alignment: 'overlay',
                    width: 500,
                    height: 130,
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
                            opacity: { value: 0.3 },
                            width: 500,
                            height: 130,
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
                                axis: 'left'
                            },
                            color: {
                                field: 'series',
                                type: 'nominal',
                                domain: industries
                            },
                            mark: 'line',
                            size: { value: 1.5 },
                            width: 500,
                            height: 130,
                            style: { outline: 'none' }
                        }
                    ])
                },
                // Timeline overview with brush
                {
                    title: 'Timeline Overview',
                    subtitle: 'Aggregate unemployment count - drag to select a time window',
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
