/**
 * Splits text into chunks no longer than `maxLength` characters so each can be
 * sent to Polly SynthesizeSpeech (limit 3,000 characters). Prefers to break
 * between sentences, then between words, and only hard-cuts as a last resort.
 */
export function splitIntoChunks(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let current = '';

    const flush = () => {
        if (current.trim().length > 0) {
            chunks.push(current.trim());
        }
        current = '';
    };

    const append = (piece: string) => {
        if (current.length + piece.length + 1 > maxLength) {
            flush();
        }
        current = current ? `${current} ${piece}` : piece;
    };

    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
        if (sentence.length <= maxLength) {
            append(sentence);
            continue;
        }

        // Sentence too long on its own - fall back to words
        for (const word of sentence.split(/\s+/)) {
            if (word.length <= maxLength) {
                append(word);
                continue;
            }

            // Single "word" longer than the limit (e.g. a long URL or garbage text)
            flush();
            for (let i = 0; i < word.length; i += maxLength) {
                chunks.push(word.slice(i, i + maxLength));
            }
        }
    }

    flush();
    return chunks;
}

/**
 * Runs `worker` over `items` with at most `concurrency` in flight, preserving
 * result order.
 */
export async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    // Safe without locks: JS is single-threaded, so `nextIndex++` can't race
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await worker(items[index], index);
        }
    });

    await Promise.all(runners);
    return results;
}
