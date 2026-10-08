import schema from './gosling.schema.json';

const definitions = (schema as { definitions: Record<string, any> }).definitions;

describe('schema docs of temporal parts', () => {
    it('describe time intervals in seconds, not chromosomes', () => {
        const description = definitions.TimeInterval.properties.interval.description;
        expect(description).not.toMatch(/chromosome/i);
        expect(description).toMatch(/seconds/);
    });

    it('describe the zoomLevel threshold in seconds on a temporal axis', () => {
        const description = definitions.ZoomLevelVisibilityCondition.properties.threshold.description;
        expect(description).toMatch(/seconds on a temporal axis/);
    });

    it('document every csv-time and json-time option', () => {
        for (const name of ['CSVTimeData', 'JsonTimeData', 'IntervalTransform']) {
            const undocumented = Object.entries(definitions[name].properties as Record<string, any>)
                .filter(([key, property]) => key !== 'type' && !property.description && !property.$ref)
                .map(([key]) => `${name}.${key}`);
            expect(undocumented).toEqual([]);
        }
    });
});
