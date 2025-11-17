import { z } from 'zod';

export const queueMessageSchema = z.object({
    bucket: z.string().min(1),
    key: z.string().min(1),
    fileSize: z.number().int().positive(),
    timestamp: z.string().datetime(),
});

export type QueueMessage = z.infer<typeof queueMessageSchema>;

