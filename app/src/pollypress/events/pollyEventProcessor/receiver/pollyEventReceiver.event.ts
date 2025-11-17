import { S3Handler, Context } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { createLogger } from '../../../common/logger';
import { initConfig } from './config';
import { queueMessageSchema } from './queueMessageSchema';

const logger = createLogger('polly-event-receiver');
const sqsClient = new SQSClient({});
const config = initConfig();

/**
 * S3 Event Handler - Triggered when a file is uploaded to the input bucket
 * Receives the file information and sends it to the processing queue
 */
export const handler: S3Handler = async (event, context: Context) => {
    logger.info('Polly Event Receiver triggered', {
        requestId: context.awsRequestId,
        recordCount: event.Records.length,
    });

    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        const fileSize = record.s3.object.size;

        logger.info('Received file upload event', { bucket, key, fileSize });

        try {
            // Validate and create queue message
            const queueMessage = queueMessageSchema.parse({
                bucket,
                key,
                fileSize,
                timestamp: new Date().toISOString(),
            });

            const sendCommand = new SendMessageCommand({
                QueueUrl: config.PROCESSING_QUEUE_URL,
                MessageBody: JSON.stringify(queueMessage),
            });

            await sqsClient.send(sendCommand);

            logger.info('File queued for processing', {
                bucket,
                key,
                queueUrl: config.PROCESSING_QUEUE_URL,
            });
        } catch (error) {
            logger.error('Error queuing file for processing', {
                key,
                bucket,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error; // Lambda will retry the event
        }
    }
};

