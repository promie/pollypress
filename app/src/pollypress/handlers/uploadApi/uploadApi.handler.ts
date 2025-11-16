import { APIGatewayProxyHandler, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLogger } from '../../common/logger';
import { getCorsHeaders, createCorsPreflightResponse } from '../../common/cors/cors';
import { generatePresignedUploadUrl } from './commands/generatePresignedUploadUrl.command';
import { initConfig } from './config';
import { bodySchema } from './bodySchema';

const logger = createLogger('upload-api');
const { INPUT_BUCKET } = initConfig();

export const handler: APIGatewayProxyHandler = async (event, context: Context): Promise<APIGatewayProxyResult> => {
    logger.info('Upload API request received', {
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
        if (!event.body) {
            logger.warn('Missing request body');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing request body' }),
            };
        }

        const parsedBody = JSON.parse(event.body);
        const validationResult = bodySchema.safeParse(parsedBody);

        if (!validationResult.success) {
            logger.warn('Invalid request body', { errors: validationResult.error.issues });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Invalid request body',
                    details: validationResult.error.issues.map(issue => ({
                        path: issue.path.join('.'),
                        message: issue.message,
                    })),
                }),
            };
        }

        const { fileName, fileType } = validationResult.data;

        // Generate presigned URL using command
        const result = await generatePresignedUploadUrl({
            fileName,
            fileType,
            bucketName: INPUT_BUCKET,
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result),
        };
    } catch (error) {
        logger.error('Error generating presigned URL', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to generate upload URL' }),
        };
    }
};
