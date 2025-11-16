import type { z } from 'zod';
import { zodErrorToApiDetail } from './zodErrorToApiDetail';

export const buildConfig = <S extends z.ZodTypeAny>(
    schema: S,
    env: Record<string, unknown> = process.env
): z.infer<S> => {
    const parsed = schema.safeParse(env);
    if (!parsed.success) {
        throw new Error(`failed to parse config because ${zodErrorToApiDetail(parsed.error)}`);
    }
    return parsed.data;
};
