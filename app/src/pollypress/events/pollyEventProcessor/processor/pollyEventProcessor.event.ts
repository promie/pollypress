import { SQSEvent, SQSHandler, Context, SQSBatchResponse } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { Readable } from 'stream';
import { createLogger } from '../../../common/logger';
import { initConfig } from './config';
import { queueMessageSchema, type QueueMessage } from '../receiver/queueMessageSchema';
import { streamToBuffer, extractText } from '../utils/fileUtils';

const logger = createLogger('polly-event-processor');
const s3Client = new S3Client({});
const pollyClient = new PollyClient({});
const config = initConfig();

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

            logger.info('Extracting text from file', { key });
            const text = await extractText(fileContent, key);
            logger.info('Text extracted successfully', {
                textLength: text.length,
                preview: text.substring(0, 100)
            });

            if (!text || text.trim().length === 0) {
                throw new Error('No text content found in file');
            }

            const truncatedText = text.slice(0, 3000);
            if (text.length > 3000) {
                logger.warn('Text truncated to fit Polly limit', {
                    originalLength: text.length,
                    truncatedLength: truncatedText.length,
                });
            }

            logger.info('Synthesizing speech with Amazon Polly', {
                textLength: truncatedText.length,
                voiceId: 'Joanna',
                engine: 'neural',
            });

            const pollyCommand = new SynthesizeSpeechCommand({
                Text: truncatedText,
                OutputFormat: 'mp3',
                VoiceId: 'Joanna', 
                Engine: 'neural',
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
            batchItemFailures.push({ itemIdentifier: messageId });
        }
    }

    return {
        batchItemFailures,
    };
};

