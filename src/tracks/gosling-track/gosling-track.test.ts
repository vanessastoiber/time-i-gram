import { PRINT_RENDERING_CYCLE, publishGenomicLocation } from './gosling-track';
import { subscribe, unsubscribe } from '../../api/pubsub';

describe('Check debug-purpose variables', () => {
    it('PRINT_RENDERING_CYCLE', () => {
        expect(PRINT_RENDERING_CYCLE).toBe(false);
    });
});

describe('JS API `location` event', () => {
    const received: unknown[] = [];
    beforeEach(() => {
        received.length = 0;
        subscribe('location', (_, data) => received.push(data));
    });
    afterEach(() => unsubscribe('location'));
    const flush = () => new Promise(resolve => setTimeout(resolve, 20)); // pubsub-js delivers asynchronously

    it('is published for genomic tracks', async () => {
        const spec = { mark: 'point', x: { field: 'p', type: 'genomic' }, width: 10, height: 10 } as any;
        publishGenomicLocation('view-1', [1, 1000], 'hg38', spec);
        await flush();
        expect(received).toEqual([
            {
                id: 'view-1',
                genomicRange: [
                    { chromosome: 'chr1', position: 1 },
                    { chromosome: 'chr1', position: 1000 }
                ]
            }
        ]);
    });

    it('is not published for temporal tracks', async () => {
        const spec = { mark: 'point', x: { field: 't', type: 'temporal' }, width: 10, height: 10 } as any;
        publishGenomicLocation('view-1', [946684800, 1262304000], 'unknown', spec);
        await flush();
        expect(received).toEqual([]);
    });
});
