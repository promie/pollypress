import { resolve } from 'path';

/**
 * Root directory of the CDK infrastructure code
 */
export const CDK_ROOT = resolve(__dirname, '..');

/**
 * Root directory of the application code
 */
export const APP_ROOT = resolve(CDK_ROOT, '..', 'app');