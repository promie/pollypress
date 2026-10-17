import { z } from 'zod';

/**
 * Status marker written by the processor to `output/<fileId>/status.json`
 * and read by the download API to report progress or failures.
 */
export const jobStatusSchema = z.discriminatedUnion('state', [
    z.object({
        state: z.literal('processing'),
        completedChunks: z.number().int().nonnegative(),
        totalChunks: z.number().int().positive(),
    }),
    z.object({
        state: z.literal('completed'),
        audioKey: z.string().min(1),
    }),
    z.object({
        state: z.literal('failed'),
        reason: z.string(),
        // Lets the frontend show a tailored message for known failures
        code: z.enum(['DAILY_LIMIT_REACHED', 'DOCUMENT_TOO_LONG']).optional(),
        // When the file can be retried (ISO 8601, UTC)
        retryAt: z.string().datetime().optional(),
    }),
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;

export type FailureCode = NonNullable<Extract<JobStatus, { state: 'failed' }>['code']>;

export const outputPrefix = (fileId: string): string => `output/${fileId}/`;

export const statusKey = (fileId: string): string => `${outputPrefix(fileId)}status.json`;

// Extracted text, saved once so continuation runs don't re-parse the PDF
export const textKey = (fileId: string): string => `${outputPrefix(fileId)}text.txt`;

export const audioKey = (fileId: string): string => `${outputPrefix(fileId)}audio.mp3`;
