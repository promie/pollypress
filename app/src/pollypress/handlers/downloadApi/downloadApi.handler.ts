import { APIGatewayProxyHandler, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLogger } from '../../common/logger';
import { getCorsHeaders, createCorsPreflightResponse } from '../../common/cors/cors';
import { generatePresignedDownloadUrl } from './commands/generatePresignedDownloadUrl.command';
import { getJobStatus } from './commands/getJobStatus.command';
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

        // Example: input/abc-123.pdf → abc-123
        const fileId = fileKey.replace(/^input\//, '').replace(/\.[^.]+$/, '');

        const jobStatus = await getJobStatus({ fileId, bucketName: OUTPUT_BUCKET });

        if (jobStatus.state === 'pending' || jobStatus.state === 'processing') {
            const progress = jobStatus.state === 'processing'
                ? { completedChunks: jobStatus.completedChunks, totalChunks: jobStatus.totalChunks }
                : undefined;
            logger.info('File not ready yet', { fileKey, progress });
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: 'File not ready',
                    message: 'The audio file is still being processed. Please try again in a few moments.',
                    progress,
                }),
            };
        }

        if (jobStatus.state === 'failed') {
            logger.warn('File processing failed', { fileKey, reason: jobStatus.reason });
            return {
                statusCode: 422,
                headers,
                body: JSON.stringify({
                    error: 'Processing failed',
                    message: jobStatus.reason,
                }),
            };
        }

        logger.info('Generating download URL for processed file', {
            inputKey: fileKey,
            outputKey: jobStatus.audioKey,
        });

        // Generate presigned URL for download
        const result = await generatePresignedDownloadUrl({
            fileKey: jobStatus.audioKey,
            bucketName: OUTPUT_BUCKET,
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result),
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
