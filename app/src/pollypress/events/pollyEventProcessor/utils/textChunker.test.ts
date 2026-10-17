import { splitIntoChunks, mapWithConcurrency } from './textChunker';

describe('splitIntoChunks', () => {
    it('keeps short text as a single chunk', () => {
        expect(splitIntoChunks('Hello there. How are you?', 100)).toEqual(['Hello there. How are you?']);
    });

    it('breaks between sentences and never exceeds the limit', () => {
        const text = Array.from({ length: 500 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
        const chunks = splitIntoChunks(text, 200);

        expect(chunks.length).toBeGreaterThan(1);
        chunks.forEach((chunk) => {
            expect(chunk.length).toBeLessThanOrEqual(200);
            expect(chunk.endsWith('.')).toBe(true);
        });
        expect(chunks.join(' ')).toBe(text);
    });

    it('falls back to word breaks for very long sentences', () => {
        const text = Array.from({ length: 100 }, () => 'word').join(' ');
        const chunks = splitIntoChunks(text, 30);

        chunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(30));
        expect(chunks.join(' ')).toBe(text);
    });

    it('hard-cuts a single token longer than the limit', () => {
        const chunks = splitIntoChunks(`Start. ${'x'.repeat(25)} end.`, 10);

        chunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(10));
        expect(chunks.join('')).toBe(`Start.${'x'.repeat(25)}end.`);
    });
});

describe('mapWithConcurrency', () => {
    it('preserves order and respects the concurrency limit', async () => {
        let inFlight = 0;
        let maxInFlight = 0;

        const results = await mapWithConcurrency([5, 1, 4, 2, 3, 0], 2, async (n) => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, n * 5));
            inFlight--;
            return n * 10;
        });

        expect(results).toEqual([50, 10, 40, 20, 30, 0]);
        expect(maxInFlight).toBe(2);
    });
});
