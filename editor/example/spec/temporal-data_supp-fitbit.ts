import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Supplementary material, Fig. S8 (FitBit Activity and Heart Rate Data; paper Fig. 5).
// Copied from the supplementary PDF. Fixed since (docs/grammar-audit.md §7): the domain covers the
// recording period (12 April to 12 May 2016) instead of March to June, and calories are colored as a
// quantitative field (as a nominal field with domain [0, 50], colors were assigned arbitrarily).
// Quantitative colors use a predefined scale, so the printed list of seven colors became `hot`.

const fitbitSpec = {
    arrangement: 'horizontal',
    xDomain: {
        interval: [1460419200, 1463097600]
    },
    views: [
        {
            arrangement: 'vertical',
            spacing: 0,
            views: [
                {
                    height: 70,
                    tracks: [
                        {
                            title: 'Heartrate per second',
                            dataTransform: [
                                {
                                    type: 'filter',
                                    field: 'Id',
                                    oneOf: ['2022484408']
                                }
                            ],
                            data: {
                                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/6_fitbit/heartrate_seconds_merged.csv',
                                type: 'csv-time',
                                dateFields: ['Time']
                            },
                            mark: 'line',
                            color: { value: 'red' },
                            x: {
                                field: 'Time',
                                type: 'temporal',
                                axis: 'none',
                                linkingId: 'linking-with-brush'
                            },
                            y: {
                                field: 'Value',
                                type: 'quantitative',
                                domain: [50, 200]
                            },
                            width: 400,
                            height: 70
                        }
                    ]
                },
                {
                    alignment: 'overlay',
                    title: 'Daily Activity',
                    dataTransform: [
                        {
                            type: 'filter',
                            field: 'Id',
                            oneOf: ['1503960366']
                        }
                    ],
                    data: {
                        url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/6_fitbit/dailyActivity_merged.csv',
                        type: 'csv-time',
                        dateFields: ['ActivityDate']
                    },
                    x: {
                        field: 'ActivityDate',
                        type: 'temporal',
                        axis: 'bottom',
                        linkingId: 'linking-with-brush'
                    },
                    width: 400,
                    height: 70,
                    tracks: [
                        {
                            mark: 'bar',
                            size: { value: 3 },
                            color: {
                                field: 'Calories',
                                type: 'quantitative',
                                range: 'hot'
                            },
                            y: {
                                field: 'TotalSteps',
                                type: 'quantitative',
                                domain: [0, 20000]
                            }
                        },
                        {
                            mark: 'line',
                            color: { value: 'black' },
                            y: {
                                field: 'VeryActiveMinutes',
                                type: 'quantitative',
                                domain: [0, 80],
                                axis: 'right'
                            }
                        }
                    ]
                }
            ]
        },
        {
            views: [
                {
                    layout: 'circular',
                    centerRadius: 0.5,
                    tracks: [
                        {
                            title: 'Heartrate per second',
                            dataTransform: [
                                {
                                    type: 'filter',
                                    field: 'Id',
                                    oneOf: ['2022484408']
                                }
                            ],
                            data: {
                                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/6_fitbit/heartrate_seconds_merged.csv',
                                type: 'csv-time',
                                dateFields: ['Time']
                            },
                            mark: 'line',
                            color: { value: 'red' },
                            x: {
                                field: 'Time',
                                type: 'temporal',
                                axis: 'bottom',
                                linkingId: 'linking-with-brush'
                            },
                            y: {
                                field: 'Value',
                                type: 'quantitative',
                                domain: [50, 200]
                            },
                            width: 300,
                            height: 20
                        }
                    ]
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_SUPP_FITBIT = fitbitSpec as unknown as GoslingSpec;
