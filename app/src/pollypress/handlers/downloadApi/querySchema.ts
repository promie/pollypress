import { z } from 'zod';

export const querySchema = z.object({
    // Key returned by the upload API, e.g. input/<uuid>.pdf
    fileKey: z.string().regex(/^input\/[A-Za-z0-9-]+\.[A-Za-z0-9]+$/, 'Invalid file key'),
});

export type QuerySchema = z.infer<typeof querySchema>;
