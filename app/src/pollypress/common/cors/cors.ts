import { APIGatewayProxyResult } from 'aws-lambda';
import { CorsConfig } from './cors.types';

const DEFAULT_CORS_CONFIG: Required<CorsConfig> = {
    allowedOrigins: '*',
    allowedHeaders: ['Content-Type'],
    allowedMethods: ['POST', 'OPTIONS'],
};

export const getCorsHeaders = (config: CorsConfig = {}): Record<string, string> => {
    const { allowedOrigins, allowedHeaders, allowedMethods } = { ...DEFAULT_CORS_CONFIG, ...config };

    const origin = Array.isArray(allowedOrigins) ? allowedOrigins.join(',') : allowedOrigins;

    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': allowedHeaders.join(','),
        'Access-Control-Allow-Methods': allowedMethods.join(','),
    };
};

export const createCorsPreflightResponse = (config: CorsConfig = {}): APIGatewayProxyResult => {
    return {
        statusCode: 200,
        headers: getCorsHeaders(config),
        body: '',
    };
};
