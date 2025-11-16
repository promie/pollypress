import { Logger } from '@aws-lambda-powertools/logger';

export function createLogger(serviceName: string): Logger {
    const logLevel = (process.env.LOG_LEVEL || 'INFO') as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

    return new Logger({
        serviceName,
        logLevel,
    });
}
