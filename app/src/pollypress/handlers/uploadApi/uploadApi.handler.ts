import { APIGatewayProxyHandler, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLogger } from '../../common/logger';
import { generatePresignedUploadUrl } from './commands/generatePresignedUploadUrl.command';

const logger = createLogger('upload-api');
const INPUT_BUCKET = process.env.INPUT_BUCKET!;

type UploadRequest = {
    fileName: string;
    fileType: string;
};

export const handler: APIGatewayProxyHandler = async (event, context: Context): Promise<APIGatewayProxyResult> => {
    logger.info('Upload API request received', {
        requestId: context.requestId,
        httpMethod: event.httpMethod,
        path: event.path,
    });

    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // In production, restrict to your domain
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        logger.info('CORS preflight request');
        return {
            statusCode: 200,
            headers,
            body: '',
        };
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

        const body: UploadRequest = JSON.parse(event.body);
        const { fileName, fileType } = body;

        if (!fileName || !fileType) {
            logger.warn('Missing required fields', { fileName: !!fileName, fileType: !!fileType });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'fileName and fileType are required' }),
            };
        }

        // Validate file type
        const allowedTypes = ['text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(fileType)) {
            logger.warn('Invalid file type', { fileType, allowedTypes });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid file type. Only .txt, .doc, and .docx files are allowed' }),
            };
        }

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
