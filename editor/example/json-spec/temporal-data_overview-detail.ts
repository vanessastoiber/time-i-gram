import type { GoslingSpec } from '@gosling-lang/gosling-schema';

export const EX_SPEC_TEMPORAL_OVERVIEW_DETAIL: GoslingSpec = {
    title: 'Temporal Data',
    subtitle: 'Unemployment rates',
    description: '',
    tracks: [
        {
            title: "Overview",
            data: { type: "json-time", timestampField: "time", values: [] },
            mark: "line",
            x: { field: "time", type: "temporal", axis: "bottom" },
            alignment: "overlay",
            tracks: [
                {},
                {
                    mark: "brush",
                    x: { linkingId: "linking-with-brush" },
                    color: { value: "steelBlue" }
                }
            ],
            width: 800,
            height: 50
        },
        {
            title: "Detail (Government)",
            dataTransform: [
                { type: "filter", field: "series", oneOf: ["Government"] }
            ],
            data: {
                url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/unemployment-across-industries.json",
                type: "json-time",
                dateFields: ["year", "month"],
            },
            mark: "line",
            color: { value: "red" },
            x: { field: "year", type: "temporal", axis: "bottom", linkingId: "linking-with-brush" },
            y: {
                field: "count",
                type: "quantitative",
                domain: [50, 2500]
            },
            width: 800,
            height: 80
        },
        {
            title: "Detail (Manufacturing)",
            dataTransform: [
                { type: "filter", field: "series", oneOf: ["Manufacturing"] }
            ],
            data: {
                url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/unemployment-across-industries.json",
                type: "json-time",
                dateFields: ["year", "month"],
            },
            mark: "line",
            color: { value: "green" },
            x: { field: "year", type: "temporal", axis: "bottom", linkingId: "linking-with-brush" },
            y: {
                field: "count",
                type: "quantitative",
                domain: [50, 2500]
            },
            width: 800,
            height: 80
        },
        {
            title: "Detail (Construction)",
            dataTransform: [
                { type: "filter", field: "series", oneOf: ["Construction"] }
            ],
            data: {
                url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/unemployment-across-industries.json",
                type: "json-time",
                dateFields: ["year", "month"],
            },
            mark: "line",
            color: { value: "blue" },
            x: { field: "year", type: "temporal", axis: "bottom", linkingId: "linking-with-brush" },
            y: {
                field: "count",
                type: "quantitative",
                domain: [50, 2500]
            },
            width: 800,
            height: 80
        },
        {
            title: "Detail (Information)",
            dataTransform: [
                { type: "filter", field: "series", oneOf: ["Information"] }
            ],
            data: {
                url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/unemployment-across-industries.json",
                type: "json-time",
                dateFields: ["year", "month"],
            },
            mark: "line",
            color: { value: "orange" },
            x: { field: "year", type: "temporal", axis: "bottom", linkingId: "linking-with-brush" },
            y: {
                field: "count",
                type: "quantitative",
                domain: [50, 2500]
            },
            width: 800,
            height: 80
        },
        {
            title: "Detail (Education and Health)",
            dataTransform: [
                { type: "filter", field: "series", oneOf: ["Education and Health"] }
            ],
            data: {
                url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/unemployment-across-industries.json",
                type: "json-time",
                dateFields: ["year", "month"],
            },
            mark: "line",
            color: { value: "orange" },
            x: { field: "year", type: "temporal", axis: "bottom", linkingId: "linking-with-brush" },
            y: {
                field: "count",
                type: "quantitative",
                domain: [50, 2500]
            },
            width: 800,
            height: 80
        }
    ]
};
