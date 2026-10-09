import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Supplementary material, Fig. S6 (NYC Taxi Trip Duration; paper Fig. 1C).
// Copied from the supplementary PDF (a fragment, wrapped in a root object). Since fixed:
// - it opens on one hour, where the arcs are drawn (they are hidden above 2 hours of visible time, and the
//   spec used to open on eight months, so the top view looked empty);
// - the bars are capped at one hour (a few trips last days and flattened every other bar);
// - titles, axis titles and legends.
// Loading takes a while: both views read the 39 MB CSV (291,000 trips).

const spec = {
    title: 'How long are New York taxi trips, and when do they start?',
    subtitle: 'Trips of one vendor on 3 February 2016, 12:35 to 13:35. Zoom out for other hours and days.',
    xDomain: { interval: ['2016-02-03T12:35:00Z', '2016-02-03T13:35:00Z'] },

    views: [
        {
            // --- Detailed view: pickup-to-dropoff intervals as within-links ---
            spacing: 0,
            width: 800,
            title: 'Trips as arcs from pickup to drop-off (longer trips, higher arcs)',

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
                        axis: 'bottom',
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
                            threshold: '2 hours',
                            target: 'track'
                        }
                    ],

                    stroke: { value: 'steelblue' },
                    style: { linkStyle: 'elliptical', linkMinHeight: 0.05 },
                    width: 800,
                    height: 160
                }
            ]
        },

        {
            // --- Overview: bar chart of trip duration, linked to the detailed view ---
            alignment: 'overlay',
            title: 'Duration of each trip, at its pickup time',
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
                        type: 'quantitative',
                        // trips of more than an hour are cut at the top
                        domain: [0, 3600],
                        title: 'Trip duration (s)'
                    },

                    // Passenger count is encoded redundantly with color and stroke
                    stroke: {
                        field: 'passenger_count',
                        type: 'nominal',
                        domain: ['1', '2', '3', '4', '5', '6', '7']
                    },
                    color: {
                        field: 'passenger_count',
                        type: 'nominal',
                        domain: ['1', '2', '3', '4', '5', '6', '7'],
                        legend: true,
                        title: 'Passengers'
                    },

                    strokeWidth: { value: 3 }
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_SUPP_NYC_TAXI = spec as unknown as GoslingSpec;
