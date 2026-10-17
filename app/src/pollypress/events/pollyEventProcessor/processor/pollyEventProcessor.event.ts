import { SQSEvent, SQSHandler, Context, SQSBatchResponse } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PollyClient, StartSpeechSynthesisTaskCommand } from '@aws-sdk/client-polly';
import { Readable } from 'stream';
import { createLogger } from '../../../common/logger';
import { outputPrefix, statusKey, type JobStatus } from '../../../common/jobStatus';
import { initConfig } from './config';
import { queueMessageSchema, type QueueMessage } from '../receiver/queueMessageSchema';
import { streamToBuffer, extractText, prepareText, UnprocessableFileError } from '../utils/fileUtils';

const logger = createLogger('polly-event-processor');
const s3Client = new S3Client({});
const pollyClient = new PollyClient({});
const config = initConfig();

// Polly asynchronous synthesis accepts up to 100,000 billed characters
const MAX_TEXT_LENGTH = 100_000;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const writeStatus = async (fileId: string, status: JobStatus): Promise<void> => {
    await s3Client.send(new PutObjectCommand({
        Bucket: config.OUTPUT_BUCKET,
        Key: statusKey(fileId),
        Body: JSON.stringify(status),
        ContentType: 'application/json',
    }));
};

export const handler: SQSHandler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
    logger.info('Polly Event Processor triggered', {
        requestId: context.awsRequestId,
        recordCount: event.Records.length,
    });

    const batchItemFailures: { itemIdentifier: string }[] = [];

    for (const record of event.Records) {
        const messageId = record.messageId;
        let messageBody: QueueMessage;

        try {
            const parsed = JSON.parse(record.body);
            messageBody = queueMessageSchema.parse(parsed);
        } catch (error) {
            logger.error('Failed to parse or validate queue message', {
                messageId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            batchItemFailures.push({ itemIdentifier: messageId });
            continue;
        }

        const { bucket, key, fileSize } = messageBody;
        const fileId = key.split('/').pop()?.split('.')[0] as string;

        logger.info('Processing file from queue', { bucket, key, fileSize, messageId });

        try {
            if (fileSize > MAX_FILE_SIZE_BYTES) {
                throw new UnprocessableFileError(
                    `File is too large (${(fileSize / 1024 / 1024).toFixed(1)} MB). The maximum is 50 MB.`
                );
            }

            logger.info('Downloading file from S3', { key });
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: bucket,
                Key: key,
            }));
            if (!response.Body) {
                throw new Error('Empty file body');
            }

            const fileContent = await streamToBuffer(response.Body as Readable);
            logger.info('File downloaded successfully', {
                key,
                contentLength: fileContent.length
            });

            logger.info('Extracting text from file', { key });
            const { text, truncated } = prepareText(await extractText(fileContent, key), MAX_TEXT_LENGTH);
            logger.info('Text extracted successfully', {
                textLength: text.length,
                truncated,
                preview: text.substring(0, 100)
            });

            if (text.length === 0) {
                throw new UnprocessableFileError(
                    'No readable text found in the file. Scanned or image-only PDFs are not supported.'
                );
            }

            if (truncated) {
                logger.warn('Text truncated to fit Polly limit', { truncatedLength: text.length });
            }

            logger.info('Starting Amazon Polly synthesis task', {
                textLength: text.length,
                voiceId: 'Joanna',
                engine: 'neural',
            });

            const task = await pollyClient.send(new StartSpeechSynthesisTaskCommand({
                Text: text,
                OutputFormat: 'mp3',
                VoiceId: 'Joanna',
                Engine: 'neural',
                LanguageCode: 'en-US',
                OutputS3BucketName: config.OUTPUT_BUCKET,
                OutputS3KeyPrefix: outputPrefix(fileId),
            }));

            const taskId = task.SynthesisTask?.TaskId;
            if (!taskId) {
                throw new Error('Polly did not return a task ID');
            }

            await writeStatus(fileId, {
                state: 'synthesizing',
                taskId,
                textLength: text.length,
                truncated,
            });

            logger.info('Polly synthesis task started', {
                inputKey: key,
                taskId,
                outputUri: task.SynthesisTask?.OutputUri,
                messageId,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            if (error instanceof UnprocessableFileError) {
                // Retrying won't help - record the failure so the user sees it
                logger.warn('File cannot be processed', { key, messageId, reason: errorMessage });
                try {
                    await writeStatus(fileId, { state: 'failed', reason: errorMessage });
                } catch (statusError) {
                    logger.error('Failed to write failure status', { key, error: statusError });
                    batchItemFailures.push({ itemIdentifier: messageId });
                }
                continue;
            }

            logger.error('Error processing file', {
                key,
                bucket,
                messageId,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            });
            batchItemFailures.push({ itemIdentifier: messageId });
        }
    }

    return {
        batchItemFailures,
    };
};
