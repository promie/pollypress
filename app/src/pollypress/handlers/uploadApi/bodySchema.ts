import { z } from 'zod';

export const bodySchema = z.object({
    fileName: z.string().min(1),
    fileType: z.enum([
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
});

export type BodySchema = z.infer<typeof bodySchema>;
