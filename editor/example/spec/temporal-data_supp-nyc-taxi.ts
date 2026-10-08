import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Supplementary material, Fig. S6 (NYC Taxi Trip Duration; paper Fig. 1C).
// Copied verbatim from the supplementary PDF. The printed spec is a fragment
// (root keys without the enclosing braces); it is wrapped in a root object here
// and the trailing `];` became `]`. Not yet fixed: see docs/grammar-audit.md §7.

const spec = {
    xDomain: { interval: [1448928000, 1470009600] },

    views: [
        {
            // --- Detailed view: pickup-to-dropoff intervals as within-links ---
            spacing: 0,
            width: 800,
            title: 'Trip Duration in Detail',

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/4_nyc-taxi-trip/nyc_taxi_trip_duration.csv',
                type: 'csv-time',
                dateFields: ['pickup_datetime', 'dropoff_datetime'],
                interval: ['pickup_datetime', 'dropoff_datetime']
            },

            tracks: [
                {
                    dataTransform: [{ type: 'filter', field: 'vendor_id', oneOf: ['1'] }],

                    mark: 'withinLink',

                    // Start and end of each trip
                    x: {
                        field: 'pickup_datetime',
                        type: 'temporal',
                        axis: 'none',
                        linkingId: '1'
                    },
                    x1: {
                        field: 'dropoff_datetime',
                        type: 'temporal'
                    },

                    // Show links only at more detailed zoom levels
                    visibility: [
                        {
                            operation: 'less-than',
                            measure: 'zoomLevel',
                            threshold: 4000,
                            target: 'track'
                        }
                    ],

                    stroke: { value: 'steelblue' },
                    style: { linkStyle: 'elliptical' }
                }
            ]
        },

        {
            // --- Overview: bar chart of trip duration, linked to the detailed view ---
            alignment: 'overlay',
            title: 'Trip Duration',
            width: 800,
            height: 160,

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/4_nyc-taxi-trip/nyc_taxi_trip_duration.csv',
                type: 'csv-time',
                dateFields: ['pickup_datetime', 'dropoff_datetime'],
                interval: ['pickup_datetime', 'dropoff_datetime']
            },

            x: {
                field: 'pickup_datetime',
                type: 'temporal',
                axis: 'bottom',
                linkingId: '1'
            },

            tracks: [
                {
                    dataTransform: [{ type: 'filter', field: 'vendor_id', oneOf: ['1'] }],

                    mark: 'bar',
                    y: {
                        field: 'trip_duration',
                        type: 'quantitative'
                    },

                    // Passenger count is encoded redundantly with color and stroke
                    stroke: {
                        field: 'passenger_count',
                        type: 'nominal',
                        domain: ['1', '2', '3', '4', '5', '6', '7'],
                        legend: true
                    },
                    color: {
                        field: 'passenger_count',
                        type: 'nominal',
                        domain: ['1', '2', '3', '4', '5', '6', '7'],
                        legend: true
                    },

                    strokeWidth: { value: 3 }
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_SUPP_NYC_TAXI = spec as unknown as GoslingSpec;
