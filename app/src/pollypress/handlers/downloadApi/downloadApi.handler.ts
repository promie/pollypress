import { APIGatewayProxyHandler, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLogger } from '../../common/logger';
import { getCorsHeaders, createCorsPreflightResponse } from '../../common/cors/cors';
import { generatePresignedDownloadUrl } from './commands/generatePresignedDownloadUrl.command';
import { initConfig } from './config';
import { querySchema } from './querySchema';

const logger = createLogger('download-api');
const { OUTPUT_BUCKET } = initConfig();

export const handler: APIGatewayProxyHandler = async (event, context: Context): Promise<APIGatewayProxyResult> => {
    logger.info('Download API request received', {
        requestId: context.awsRequestId,
        httpMethod: event.httpMethod,
        path: event.path,
    });

    const headers = getCorsHeaders();

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        logger.info('CORS preflight request');
        return createCorsPreflightResponse();
    }

    try {
        if (!event.queryStringParameters) {
            logger.warn('Missing query parameters');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing fileKey query parameter' }),
            };
        }

        const validationResult = querySchema.safeParse(event.queryStringParameters);

        if (!validationResult.success) {
            logger.warn('Invalid query parameters', { errors: validationResult.error.issues });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Invalid query parameters',
                    details: validationResult.error.issues.map(issue => ({
                        path: issue.path.join('.'),
                        message: issue.message,
                    })),
                }),
            };
        }

        const { fileKey } = validationResult.data;

        // Convert input file key to output file key
        // Example: input/abc-123.txt → output/abc-123.mp3
        const outputFileKey = fileKey
            .replace(/^input\//, 'output/')  // Replace 'input/' prefix with 'output/'
            .replace(/\.[^.]+$/, '.mp3');     // Replace extension with .mp3

        logger.info('Generating download URL for processed file', {
            inputKey: fileKey,
            outputKey: outputFileKey
        });

        // Generate presigned URL for download
        const result = await generatePresignedDownloadUrl({
            fileKey: outputFileKey,
            bucketName: OUTPUT_BUCKET,
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result),
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Check if it's a "file not found" error
        if (errorMessage.includes('not found')) {
            logger.info('File not ready yet', { error: errorMessage });
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: 'File not ready',
                    message: 'The audio file is still being processed. Please try again in a few moments.'
                }),
            };
        }

        logger.error('Error generating presigned download URL', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
        });

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to generate download URL' }),
        };
    }
};
