import { z } from 'zod';
import { buildConfig } from '../../../common/zod/buildConfig';

const config = z.object({
    OUTPUT_BUCKET: z.string().min(1),
    PROCESSING_QUEUE_URL: z.string().url(),
    USAGE_TABLE: z.string().min(1),
    DAILY_CHARACTER_LIMIT: z.coerce.number().int().positive(),
});

export type Config = z.infer<typeof config>;

export type ConfigInput = z.input<typeof config>;

export const initConfig = (): Config => buildConfig(config);

