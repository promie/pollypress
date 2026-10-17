import { z } from 'zod';

/** Sent by the receiver when a file lands in the input bucket */
export const queueMessageSchema = z.object({
    bucket: z.string().min(1),
    key: z.string().min(1),
    fileSize: z.number().int().positive(),
    timestamp: z.string().datetime(),
});

export type QueueMessage = z.infer<typeof queueMessageSchema>;

/**
 * Sent by the processor to itself when it runs low on Lambda time, so long
 * documents are synthesized across as many invocations as needed.
 */
export const continuationMessageSchema = z.object({
    type: z.literal('continue'),
    fileId: z.string().min(1),
    uploadId: z.string().min(1),
    nextChunk: z.number().int().nonnegative(),
    parts: z.array(z.object({
        PartNumber: z.number().int().positive(),
        ETag: z.string().min(1),
    })),
});

export type ContinuationMessage = z.infer<typeof continuationMessageSchema>;

export const processorMessageSchema = z.union([continuationMessageSchema, queueMessageSchema]);

export type ProcessorMessage = z.infer<typeof processorMessageSchema>;
