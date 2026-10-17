import { z } from 'zod';

/**
 * Status marker written by the processor to `output/<fileId>/status.json`
 * and read by the download API to report progress or failures.
 */
export const jobStatusSchema = z.discriminatedUnion('state', [
    z.object({
        state: z.literal('synthesizing'),
        taskId: z.string().min(1),
        textLength: z.number().int().nonnegative(),
        truncated: z.boolean(),
    }),
    z.object({
        state: z.literal('failed'),
        reason: z.string(),
    }),
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;

export const outputPrefix = (fileId: string): string => `output/${fileId}/`;

export const statusKey = (fileId: string): string => `${outputPrefix(fileId)}status.json`;

// Polly async tasks write their audio to `<OutputS3KeyPrefix><TaskId>.<format>`
export const audioKey = (fileId: string, taskId: string): string => `${outputPrefix(fileId)}${taskId}.mp3`;
