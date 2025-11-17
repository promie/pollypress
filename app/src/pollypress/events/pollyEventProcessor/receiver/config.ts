import { z } from 'zod';
import { buildConfig } from '../../../common/zod/buildConfig';

const config = z.object({
    PROCESSING_QUEUE_URL: z.string().url(),
});

export type Config = z.infer<typeof config>;

export type ConfigInput = z.input<typeof config>;

export const initConfig = (): Config => buildConfig(config);

