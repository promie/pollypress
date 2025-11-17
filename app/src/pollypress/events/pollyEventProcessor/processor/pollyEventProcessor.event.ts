import { SQSEvent, SQSHandler, Context, SQSBatchResponse } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { Readable } from 'stream';
import { createLogger } from '../../../common/logger';
import { initConfig } from './config';
import { queueMessageSchema, type QueueMessage } from '../receiver/queueMessageSchema';

const logger = createLogger('polly-event-processor');
const s3Client = new S3Client({});
const pollyClient = new PollyClient({});
const config = initConfig();

/**
 * Converts a readable stream to a buffer
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

/**
 * Extracts text from different file types
 */
async function extractText(fileContent: Buffer, fileKey: string): Promise<string> {
    const extension = fileKey.split('.').pop()?.toLowerCase();

    // For now, we only handle .txt files
    // TODO: Add support for .doc and .docx using libraries like mammoth
    if (extension === 'txt') {
        return fileContent.toString('utf-8');
    }

    throw new Error(`Unsupported file type: ${extension}. Currently only .txt files are supported.`);
}

/**
 * SQS Event Handler - Triggered when a message is received from the processing queue
 * Processes the file and converts it to speech using Amazon Polly
 */
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

        logger.info('Processing file from queue', { bucket, key, fileSize, messageId });

        try {
            // 1. Download the file from S3
            logger.info('Downloading file from S3', { key });
            const getCommand = new GetObjectCommand({
                Bucket: bucket,
                Key: key,
            });

            const response = await s3Client.send(getCommand);
            if (!response.Body) {
                throw new Error('Empty file body');
            }

            const fileContent = await streamToBuffer(response.Body as Readable);
            logger.info('File downloaded successfully', {
                key,
                contentLength: fileContent.length
            });

            // 2. Extract text from the file
            logger.info('Extracting text from file', { key });
            const text = await extractText(fileContent, key);
            logger.info('Text extracted successfully', {
                textLength: text.length,
                preview: text.substring(0, 100)
            });

            if (!text || text.trim().length === 0) {
                throw new Error('No text content found in file');
            }

            // Limit text length (Polly has a 3000 character limit for standard voices)
            const truncatedText = text.slice(0, 3000);
            if (text.length > 3000) {
                logger.warn('Text truncated to fit Polly limit', {
                    originalLength: text.length,
                    truncatedLength: truncatedText.length,
                });
            }

            // 3. Convert text to speech using Amazon Polly
            logger.info('Synthesizing speech with Amazon Polly', {
                textLength: truncatedText.length,
                voiceId: 'Joanna',
                engine: 'neural',
            });

            const pollyCommand = new SynthesizeSpeechCommand({
                Text: truncatedText,
                OutputFormat: 'mp3',
                VoiceId: 'Joanna', // You can make this configurable
                Engine: 'neural', // Neural voices sound more natural
                LanguageCode: 'en-US',
            });

            const pollyResponse = await pollyClient.send(pollyCommand);

            if (!pollyResponse.AudioStream) {
                throw new Error('No audio stream returned from Polly');
            }

            const audioBuffer = await streamToBuffer(pollyResponse.AudioStream as Readable);
            logger.info('Speech synthesis completed', {
                audioSize: audioBuffer.length
            });

            // 4. Upload the audio file to the output bucket
            const fileId = key.split('/').pop()?.split('.')[0];
            const outputKey = `output/${fileId}.mp3`;

            logger.info('Uploading audio to S3', {
                bucket: config.OUTPUT_BUCKET,
                outputKey
            });

            const putCommand = new PutObjectCommand({
                Bucket: config.OUTPUT_BUCKET,
                Key: outputKey,
                Body: audioBuffer,
                ContentType: 'audio/mpeg',
            });

            await s3Client.send(putCommand);
            logger.info('Audio file saved successfully', {
                s3Uri: `s3://${config.OUTPUT_BUCKET}/${outputKey}`,
                audioSize: audioBuffer.length,
            });

            logger.info('File processing completed successfully', {
                inputKey: key,
                outputKey,
                messageId,
            });
        } catch (error) {
            logger.error('Error processing file', {
                key,
                bucket,
                messageId,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            // Report this message as failed so it can be retried or sent to DLQ
            batchItemFailures.push({ itemIdentifier: messageId });
        }
    }

    return {
        batchItemFailures,
    };
};

