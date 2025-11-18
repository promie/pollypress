import { z } from 'zod';

export const querySchema = z.object({
    fileKey: z.string().min(1),
});

export type QuerySchema = z.infer<typeof querySchema>;
