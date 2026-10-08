import type * as d3 from 'd3';
import type {
    SingleTrack,
    Datum,
    FilterTransform,
    IntervalTransform,
    LogTransform,
    ExonSplitTransform,
    Assembly,
    StrConcatTransform,
    StrReplaceTransform,
    GenomicLengthTransform,
    SvTypeTransform,
    CoverageTransform,
    DisplaceTransform,
    JsonParseTransform,
    TimeUnitTransform,
    SpanTransform
} from '@gosling-lang/gosling-schema';
import {
    getChannelKeysByAggregateFnc,
    getChannelKeysByType,
    IsChannelDeep,
    IsIncludeFilter,
    IsOneOfFilter,
    IsRangeFilter
} from '@gosling-lang/gosling-schema';
import { computeChromSizes } from './assembly';
import { median as d3median } from 'd3-array';
import { addDuration, floorTime, offsetTime, parseDurationParts } from './time-units';
import {
    unitEndCoordinate,
    unitStartCoordinate,
    type TimeAggregateOp,
    type TimeCoordinateSystem,
    type TimeUnitBinning
} from './time-coordinate-system';
// import Logging from './log';

/**
 * Apply filter
 */
export function filterData(filter: FilterTransform, data: Datum[]): Datum[] {
    const { field, not } = filter;

    let output: Datum[] = Array.from(data);
    if (IsOneOfFilter(filter)) {
        const { oneOf } = filter;
        output = output.filter((d: Datum) => {
            return not ? (oneOf as any[]).indexOf(d[field]) === -1 : (oneOf as any[]).indexOf(d[field]) !== -1;
        });
    } else if (IsRangeFilter(filter)) {
        const { inRange } = filter;
        output = output.filter((d: Datum) => {
            const value = +d[field];
            return not ? !(inRange[0] <= value && value <= inRange[1]) : inRange[0] <= value && value <= inRange[1];
        });
    } else if (IsIncludeFilter(filter)) {
        const { include } = filter;
        output = output.filter((d: Datum) => {
            return not ? `${d[field]}`.includes(include) : !`${d[field]}`.includes(include);
        });
    }
    return output;
}

/**
 * Add new field that contains the next year that is found in the descendant rows to support the creation of intervals.
 * Limitation: This function assumes that there is one column that contains the year in the format YYYY and a column that contains the calendar week
 */
export function enableInterval(filter: IntervalTransform, data: Datum[]): any {
    if (data.length === 0) {
        return data;
    }
    data.sort((a, b) => {
        // Sort by ISO_YEAR and then by ISO_WEEK if years are equal
        return Number(a[filter.yearField]) - Number(b[filter.yearField]) || Number(a[filter.weekField]) - Number(b[filter.weekField]);
    });
    
    const transformedData = data.map((row, index, array) => {
        // Clone the current item to avoid mutating the original data
        const transformedRow = {...row};
        // Check if the next row is the start of a new year
        if (index < array.length - 1 && array[index + 1][filter.yearField] !== row[filter.yearField]) {
            const endDate = array[index + 1][filter.transformedDateField];
            transformedRow[filter.newField] = endDate;
        }
        return transformedRow;
    });
    return transformedData;
}

/**
 * Truncate a time field (Unix seconds) to the start of its calendar unit, and optionally store the unit's end.
 */
export function truncateTime(t: TimeUnitTransform, data: Datum[]): Datum[] {
    const { field, unit, newField, endField } = t;
    return data.map(d => {
        const value = +d[field];
        const start = floorTime(value, unit);
        const row: Datum = { ...d, [newField ?? field]: start };
        if (endField) row[endField] = offsetTime(start, unit, 1);
        return row;
    });
}

let hasWarnedNegativeSpan = false;

/**
 * Turn spans into intervals: `newField` = `field` + a duration (a numeric field in `unit`, or a duration literal).
 */
export function addSpan(t: SpanTransform, data: Datum[]): Datum[] {
    const literal = parseDurationParts(t.duration);
    return data.map(d => {
        const start = +d[t.field];
        const [n, unit] = literal ? [literal.value, literal.unit] : [+d[t.duration], t.unit ?? 'second'];
        let end = isFinite(start) && isFinite(n) && n >= 0 ? addDuration(start, unit, n) : NaN;
        if (n < 0) {
            if (!hasWarnedNegativeSpan) console.warn(`[time-i-gram] span: negative durations in "${t.duration}" are not drawn.`);
            hasWarnedNegativeSpan = true;
            end = NaN;
        }
        return { ...d, [t.newField]: end };
    });
}

const reducers: Record<TimeAggregateOp, (values: number[], count: number) => number> = {
    count: (_, count) => count,
    sum: values => values.reduce((a, b) => a + b, 0),
    mean: values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN),
    median: values => d3median(values) ?? NaN,
    min: values => (values.length ? Math.min(...values) : NaN),
    max: values => (values.length ? Math.max(...values) : NaN)
};

/**
 * `x.timeUnit`: place every row at the start of its time unit (coordinates in the axis' time coordinate system)
 * and, if channels are aggregated, reduce the rows of each unit and group (the fields of nominal channels)
 * to one row. Rows without a valid time are dropped.
 */
export function binByTimeUnit(binning: TimeUnitBinning, data: Datum[], cs: TimeCoordinateSystem): Datum[] {
    const { unit, source, field, endField, groupby, aggregates } = binning;
    const placed: Datum[] = [];
    data.forEach(d => {
        const t = +d[source];
        if (!isFinite(t)) return;
        placed.push({ ...d, [field]: unitStartCoordinate(t, unit, cs), [endField]: unitEndCoordinate(t, unit, cs) });
    });
    if (aggregates.length === 0) return placed;

    const groups = new Map<string, Datum[]>();
    placed.forEach(d => {
        const key = JSON.stringify([d[field], ...groupby.map(g => d[g])]);
        const group = groups.get(key);
        if (group) group.push(d);
        else groups.set(key, [d]);
    });
    return Array.from(groups.values()).map(rows => {
        const first = rows[0];
        const row: Datum = {
            [source]: cs.kind === 'relative' ? first[field] : floorTime(+first[source], unit),
            [field]: first[field],
            [endField]: first[endField]
        };
        groupby.forEach(g => (row[g] = first[g]));
        aggregates.forEach(({ field: f, op }) => {
            const values = rows.map(r => +r[f]).filter(v => isFinite(v));
            row[f] = reducers[op](values, rows.length);
        });
        return row;
    });
}

/**
 * Calculate new data, like log transformation.
 */
export function concatString(concat: StrConcatTransform, data: Datum[]): Datum[] {
    const { fields, separator, newField } = concat;

    let output: Datum[] = Array.from(data);
    output = output.map(d => {
        const strs = fields.map(f => d[f]);
        d[newField] = strs.join(separator);
        return d;
    });
    return output;
}

export function replaceString(_: StrReplaceTransform, data: Datum[]): Datum[] {
    const { field, replace, newField } = _;

    let output: Datum[] = Array.from(data);
    output = output.map(d => {
        d[newField] = d[field]; // copy original string
        replace.forEach(r => {
            const { from, to } = r;
            d[newField] = d[newField].toString().replaceAll(from, to);
        });
        return d;
    });
    return output;
}

/**
 * Calculate new data, like log transformation.
 */
export function calculateData(log: LogTransform, data: Datum[]): Datum[] {
    const { field, base, newField } = log;

    let output: Datum[] = Array.from(data);
    output = output.map(d => {
        if (+d[field]) {
            if (base === 'e') {
                d[newField ?? field] = Math.log(+d[field]);
            } else {
                d[newField ?? field] = Math.log(+d[field]) / Math.log(base ?? 10);
            }
        }
        return d;
    });
    return output;
}

/**
 * Calculate genomic length using two genomic fields.
 */
export function calculateGenomicLength(_: GenomicLengthTransform, data: Datum[]): Datum[] {
    const { startField, endField, newField } = _;
    const output = Array.from(data);
    output.forEach(d => {
        const s = d[startField];
        const e = d[endField];
        if (!s || !e) {
            // such field does not exist, so skip this row
            // console.warn(`[Genomic Length] startField or endField (${s} or ${e}) does not exist.`);
            return;
        }
        d[newField] = Math.abs(+e - +s);
    });
    return output;
}

/*
 * Infer SV types (i.e., one of DUP, TRA, DEL, t2tINV, h2hINV).
 */
export function inferSvType(_: SvTypeTransform, data: Datum[]): Datum[] {
    const { firstBp, secondBp, newField } = _;
    const output = Array.from(data);
    const [DUP, TRA, DEL, t2tINV, h2hINV] = ['DUP', 'TRA', 'DEL', 't2tINV', 'h2hINV'];

    output.forEach(d => {
        const chr1 = d[firstBp.chrField];
        const chr2 = d[secondBp.chrField];

        if (chr1 !== chr2) {
            d[newField] = TRA;
            return;
        }

        let pos1 = d[firstBp.posField];
        let pos2 = d[secondBp.posField];
        let strand1 = d[firstBp.strandField];
        let strand2 = d[secondBp.strandField];

        if (pos1 > pos2) {
            // need to sort first
            const _pos = pos1;
            const _strand = strand1;
            pos1 = pos2;
            strand1 = strand2;
            pos2 = _pos;
            strand2 = _strand;
        }

        switch (`${strand1}${strand2}`) {
            case '+-':
                d[newField] = DEL;
                break;
            case '--':
                d[newField] = t2tINV;
                break;
            case '++':
                d[newField] = h2hINV;
                break;
            case '-+':
                d[newField] = DUP;
                break;
            default:
                d[newField] = 'unknown';
        }
    });
    return output;
}

/**
 * Aggregate data rows and calculate coverage of reads.
 */
export function aggregateCoverage(
    _: CoverageTransform,
    data: Datum[],
    scale: d3.ScaleContinuousNumeric<number, number>
): Datum[] {
    // Logging.recordTime('aggregateCoverage');

    const { startField, endField, newField, groupField } = _;

    const coverage: { [group: string]: { [position: string]: number } } = {};

    // Calculate coverage by one pixel.
    const binSize = 1;
    data.forEach(d => {
        const curStart = scale(d[startField] as number);
        const curEnd = scale(d[endField] as number);
        const group = groupField ? d[groupField] : '__NO_GROUP__';

        const adjustedStart = Math.floor(curStart);
        for (let i = adjustedStart; i < curEnd; i += binSize) {
            if (!coverage[group]) {
                coverage[group] = {};
            }
            if (!coverage[group][i]) {
                coverage[group][i] = 0;
            }
            coverage[group][i]++;
        }
    });

    const output = Object.entries(coverage).flatMap(group => {
        const [groupName, coverageRecords] = group;
        return Object.entries(coverageRecords).map(entry => {
            const [key, value] = entry;
            return {
                [startField]: scale.invert(+key),
                [endField]: scale.invert(+key + binSize),
                [newField ?? 'coverage']: value,
                [groupField ?? 'group']: groupName
            };
        });
    });

    // console.log(coverage);
    // Logging.printTime('aggregateCoverage');
    return output;
}

/**
 * Mark displacement transform furnctions.
 * @param t An object that contains data transformation spec.
 * @param data An array of objects that contain data.
 * @param scale A d3's linear scale that map between data-level values to screen-level values (px).
 * @returns
 */
export function displace(
    t: DisplaceTransform,
    data: Datum[],
    scale: d3.ScaleContinuousNumeric<number, number>
): Datum[] {
    const { boundingBox, method, newField } = t;
    const { startField, endField, groupField } = boundingBox;

    let paddingInBp = 0;
    if (boundingBox.padding && scale && !boundingBox.isPaddingBP) {
        paddingInBp = Math.abs(scale.invert(boundingBox.padding) - scale.invert(0));
    } else if (boundingBox.padding && boundingBox.isPaddingBP) {
        paddingInBp = boundingBox.padding;
    }

    // Check whether we have sufficient information.
    const base = Array.from(data);
    if (base && base.length > 0) {
        if (!Object.keys(base[0]).find(d => d === startField) || !Object.keys(base[0]).find(d => d === endField)) {
            // We did not find the fields from the data, so exit here.
            return base;
        }
    }

    if (method === 'pile') {
        // This piling algorithm is heavily based on
        // https://github.com/higlass/higlass-pileup/blob/8538a34c6d884c28455d6178377ee1ea2c2c90ae/src/bam-fetcher-worker.js#L626
        const { maxRows } = t;
        const occupiedSpaceInRows: { [group: string]: { start: number; end: number }[] } = {};

        const sorted = base.sort((a: Datum, b: Datum) => (a[startField] as number) - (b[startField] as number));

        sorted.forEach((d: Datum) => {
            const start = +d[startField] - paddingInBp;
            const end = +d[endField] + paddingInBp;

            // Create object if none
            const group = groupField ? d[groupField] : '__NO_GROUP__';
            if (!occupiedSpaceInRows[group]) {
                occupiedSpaceInRows[group] = [];
            }

            // Find a row to place this segment
            let rowIndex = occupiedSpaceInRows[group].findIndex(d => {
                // Find a space and update the occupancy info.
                if (end < d.start) {
                    d.start = start;
                    return true;
                } else if (d.end < start) {
                    d.end = end;
                    return true;
                }
                return false;
            });

            if (rowIndex === -1) {
                // We did not find sufficient space from the existing rows, so add a new row.
                occupiedSpaceInRows[group].push({ start, end });
                rowIndex = occupiedSpaceInRows[group].length - 1;
            }

            d[newField] = `${maxRows && maxRows <= rowIndex ? maxRows - 1 : rowIndex}`;
        });
    } else if (method === 'spread') {
        const boundingBoxes: { start: number; end: number }[] = [];

        base.sort((a: Datum, b: Datum) => (a[startField] as number) - (b[startField] as number)).forEach((d: Datum) => {
            let start = (d[startField] as number) - paddingInBp;
            let end = (d[endField] as number) + paddingInBp;

            let overlapped = boundingBoxes.filter(
                box =>
                    (box.start === start && end === box.end) ||
                    (box.start < start && start < box.end) ||
                    (box.start < end && end < box.end) ||
                    (start < box.start && box.end < end)
            );

            if (overlapped.length > 0) {
                let trial = 0;
                do {
                    overlapped = boundingBoxes.filter(
                        box =>
                            (box.start === start && end === box.end) ||
                            (box.start < start && start < box.end) ||
                            (box.start < end && end < box.end) ||
                            (start < box.start && box.end < end)
                    );
                    if (overlapped.length > 0) {
                        if (trial % 2 === 0) {
                            start += paddingInBp * trial;
                            end += paddingInBp * trial;
                        } else {
                            start -= paddingInBp * trial;
                            end -= paddingInBp * trial;
                        }
                    }
                    trial++;
                    // TODO: do not go outside of a tile.
                } while (overlapped.length > 0 && trial < 1000);
            }

            d[`${newField}Start`] = `${start + paddingInBp}`;
            d[`${newField}Etart`] = `${end - paddingInBp}`;

            boundingBoxes.push({ start, end });
        });
    }

    // Logging.printTime('displace()');
    return base;
}

export function splitExon(split: ExonSplitTransform, data: Datum[], assembly: Assembly = 'hg38'): Datum[] {
    const { separator, fields, flag } = split;
    let output: Datum[] = Array.from(data);
    output = output
        .map((d: Datum) => {
            const newRows: Datum[] = [];

            fields.forEach(f => {
                const { field, type, newField, chrField } = f;
                const splitted = d[field].toString().split(separator);

                splitted.forEach((s, i) => {
                    let newValue: string | number = s;
                    if (type === 'genomic') {
                        newValue = computeChromSizes(assembly).interval[d[chrField]][0] + +s;
                    }
                    if (!newRows[i]) {
                        // No row exist, so create one.
                        newRows[i] = Object.assign(JSON.parse(JSON.stringify(d)), {
                            [newField]: newValue,
                            [flag.field]: flag.value
                        });
                    } else {
                        newRows[i][newField] = newValue;
                    }
                });
            });
            return [d, ...newRows];
        })
        .reduce((a, b) => a.concat(b), []);
    return output;
}

// TODO: Get this data from the fetcher as a default with a flag variable.
export function parseSubJSON(_: JsonParseTransform, data: Datum[]): Datum[] {
    const { field, genomicField, baseGenomicField, genomicLengthField } = _;
    let output: Datum[] = Array.from(data);
    output = output
        .map((d: Datum) => {
            let newRows: Datum[] = JSON.parse(d[field] as string);

            newRows = newRows.map(row => {
                if (row[genomicField] && d[baseGenomicField]) {
                    row[`${genomicField}_start`] = +row[genomicField] + +d[baseGenomicField];
                    row[`${genomicField}_end`] = +row[genomicField] + +d[baseGenomicField] + +row[genomicLengthField];
                }

                return Object.assign(JSON.parse(JSON.stringify(d)), {
                    ...row,
                    [`${genomicField}_start`]: row[`${genomicField}_start`],
                    [`${genomicField}_end`]: row[`${genomicField}_end`],
                    type: row.type ?? row.variant ?? null,
                    isParsedRow: 'yes'
                });
            });

            return [d, ...newRows];
        })
        .reduce((a, b) => a.concat(b), []);
    return output;
}

/**
 * Experimental! Only support one category supported yet.
 */
export function aggregateData(spec: SingleTrack, data: Datum[]): Datum[] {
    if (getChannelKeysByAggregateFnc(spec).length === 0) {
        // we do not have aggregated fields
        return data;
    }

    const nChannelKeys = getChannelKeysByType(spec, 'nominal');

    if (nChannelKeys.length !== 1) {
        console.warn('Currently, we only support aggregating datasets with single nominal field.');
        return data;
    }

    const nFieldSpec = spec[nChannelKeys[0]];
    if (!IsChannelDeep(nFieldSpec)) {
        // this shouldn't be reached
        return data;
    }

    const nField = nFieldSpec.field;
    if (!nField) {
        // this shouldn't be reached
        return data;
    }

    const qChannelKeys = [...getChannelKeysByType(spec, 'quantitative'), ...getChannelKeysByType(spec, 'genomic'), ...getChannelKeysByType(spec, 'temporal')];
    const aggregated: { [k: string]: number | string }[] = [];

    const uniqueCategories = Array.from(new Set(data.map(d => d[nField])));

    let failed = false;
    uniqueCategories.forEach(c => {
        const datum: { [k: string]: string | number } = {};

        datum[nField] = c;

        // for each quantitative fields
        qChannelKeys.forEach(q => {
            const qFieldSpec = spec[q];
            if (!IsChannelDeep(qFieldSpec)) {
                // this shouldn't be reached
                failed = true;
                return;
            }

            const { field: qField } = qFieldSpec;
            if (!qField || !('aggregate' in qFieldSpec)) {
                // this shouldn't be reached
                failed = true;
                return;
            }

            datum[qField] =
                qFieldSpec.aggregate === 'max'
                    ? Math.max(...data.filter(d => d[nField] === c).map(d => +d[qField]))
                    : Math.min(...data.filter(d => d[nField] === c).map(d => +d[qField]));
        });

        aggregated.push(datum);
    });

    // set aggregated data only if we successfully generated it
    return !failed ? aggregated : data;
}
