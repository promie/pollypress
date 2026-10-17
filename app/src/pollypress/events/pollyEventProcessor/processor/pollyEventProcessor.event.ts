import { SQSEvent, SQSHandler, Context, SQSBatchResponse } from 'aws-lambda';
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { Readable } from 'stream';
import { createLogger } from '../../../common/logger';
import { audioKey, statusKey, textKey, type JobStatus } from '../../../common/jobStatus';
import { initConfig } from './config';
import {
    processorMessageSchema,
    type ContinuationMessage,
    type ProcessorMessage,
    type QueueMessage,
} from '../receiver/queueMessageSchema';
import { streamToBuffer, extractText, normalizeText, UnprocessableFileError } from '../utils/fileUtils';
import { splitIntoChunks, mapWithConcurrency } from '../utils/textChunker';

const logger = createLogger('polly-event-processor');
const s3Client = new S3Client({});
const sqsClient = new SQSClient({});
// Adaptive retries back off automatically when Polly throttles parallel requests
const pollyClient = new PollyClient({ maxAttempts: 10, retryMode: 'adaptive' });
const config = initConfig();

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;
// SynthesizeSpeech accepts up to 3,000 characters; leave headroom
const MAX_CHUNK_LENGTH = 2_900;
// Stays within Polly's default neural SynthesizeSpeech rate limit
const SYNTHESIS_CONCURRENCY = 8;
const CHUNKS_PER_BATCH = SYNTHESIS_CONCURRENCY * 2;
// S3 multipart parts (except the last) must be at least 5 MB
const MIN_PART_SIZE_BYTES = 8 * 1024 * 1024;
// Hand off to a fresh invocation well before the Lambda timeout
const CONTINUATION_THRESHOLD_MS = 3 * 60 * 1000;
// Matches maxReceiveCount on the queue's DLQ redrive policy
const MAX_RECEIVE_COUNT = 3;

type SynthesisState = Omit<ContinuationMessage, 'type'>;

type ChunkPart = { PartNumber: number; ETag: string };

const writeStatus = async (fileId: string, status: JobStatus): Promise<void> => {
    await s3Client.send(new PutObjectCommand({
        Bucket: config.OUTPUT_BUCKET,
        Key: statusKey(fileId),
        Body: JSON.stringify(status),
        ContentType: 'application/json',
    }));
};

const synthesizeChunk = async (text: string): Promise<Buffer> => {
    const response = await pollyClient.send(new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: 'mp3',
        VoiceId: 'Joanna',
        Engine: 'neural',
        LanguageCode: 'en-US',
    }));

    if (!response.AudioStream) {
        throw new Error('No audio stream returned from Polly');
    }

    return streamToBuffer(response.AudioStream as Readable);
};

const uploadPart = async (fileId: string, uploadId: string, partNumber: number, body: Buffer): Promise<ChunkPart> => {
    const response = await s3Client.send(new UploadPartCommand({
        Bucket: config.OUTPUT_BUCKET,
        Key: audioKey(fileId),
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
    }));

    if (!response.ETag) {
        throw new Error(`No ETag returned for part ${partNumber}`);
    }

    return { PartNumber: partNumber, ETag: response.ETag };
};

/**
 * Synthesizes chunks from `state.nextChunk` onwards, streaming the audio into
 * an S3 multipart upload. If the Lambda runs low on time it queues a
 * continuation message and returns, so there is no limit on document length.
 */
const synthesize = async (state: SynthesisState, text: string, context: Context): Promise<void> => {
    const { fileId, uploadId } = state;
    const chunks = splitIntoChunks(text, MAX_CHUNK_LENGTH);
    const totalChunks = chunks.length;
    const parts = [...state.parts];

    // Audio not yet uploaded as a part, and the first chunk it covers. If we
    // hand off, the next run re-synthesizes from `bufferStartChunk`.
    let buffer: Buffer[] = [];
    let bufferedBytes = 0;
    let bufferStartChunk = state.nextChunk;
    let index = state.nextChunk;

    logger.info('Synthesizing speech with Amazon Polly', {
        fileId,
        totalChunks,
        startChunk: index,
        partsSoFar: parts.length,
        concurrency: SYNTHESIS_CONCURRENCY,
    });

    await writeStatus(fileId, { state: 'processing', completedChunks: index, totalChunks });

    while (index < totalChunks) {
        if (context.getRemainingTimeInMillis() < CONTINUATION_THRESHOLD_MS) {
            if (bufferStartChunk === state.nextChunk) {
                throw new Error('No progress made before running out of time');
            }

            logger.info('Running low on time, queueing continuation', {
                fileId,
                nextChunk: bufferStartChunk,
                totalChunks,
                parts: parts.length,
            });

            await sqsClient.send(new SendMessageCommand({
                QueueUrl: config.PROCESSING_QUEUE_URL,
                MessageBody: JSON.stringify({
                    type: 'continue',
                    fileId,
                    uploadId,
                    nextChunk: bufferStartChunk,
                    parts,
                } satisfies ContinuationMessage),
            }));
            return;
        }

        const batch = chunks.slice(index, index + CHUNKS_PER_BATCH);
        const audio = await mapWithConcurrency(batch, SYNTHESIS_CONCURRENCY, synthesizeChunk);
        index += batch.length;

        for (const part of audio) {
            buffer.push(part);
            bufferedBytes += part.length;
        }

        if (bufferedBytes >= MIN_PART_SIZE_BYTES) {
            // MP3 frames are self-contained, so parts can be joined directly
            parts.push(await uploadPart(fileId, uploadId, parts.length + 1, Buffer.concat(buffer)));
            buffer = [];
            bufferedBytes = 0;
            bufferStartChunk = index;
        }

        await writeStatus(fileId, { state: 'processing', completedChunks: index, totalChunks });
    }

    if (buffer.length > 0) {
        // The final part may be smaller than the 5 MB minimum
        parts.push(await uploadPart(fileId, uploadId, parts.length + 1, Buffer.concat(buffer)));
    }

    await s3Client.send(new CompleteMultipartUploadCommand({
        Bucket: config.OUTPUT_BUCKET,
        Key: audioKey(fileId),
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
    }));

    await writeStatus(fileId, { state: 'completed', audioKey: audioKey(fileId) });

    logger.info('Speech synthesis completed', { fileId, totalChunks, parts: parts.length });
};

/**
 * First run for an uploaded file: extract its text, save it for any
 * continuation runs, and start the multipart upload for the audio.
 */
const startProcessing = async (message: QueueMessage, fileId: string, context: Context): Promise<void> => {
    const { bucket, key, fileSize } = message;

    if (fileSize > MAX_FILE_SIZE_BYTES) {
        throw new UnprocessableFileError(
            `File is too large (${(fileSize / 1024 / 1024).toFixed(1)} MB). The maximum is 200 MB.`
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
    const text = normalizeText(await extractText(fileContent, key));
    logger.info('Text extracted successfully', {
        textLength: text.length,
        preview: text.substring(0, 100)
    });

    if (text.length === 0) {
        throw new UnprocessableFileError(
            'No readable text found in the file. Scanned or image-only PDFs are not supported.'
        );
    }

    await s3Client.send(new PutObjectCommand({
        Bucket: config.OUTPUT_BUCKET,
        Key: textKey(fileId),
        Body: text,
        ContentType: 'text/plain; charset=utf-8',
    }));

    const upload = await s3Client.send(new CreateMultipartUploadCommand({
        Bucket: config.OUTPUT_BUCKET,
        Key: audioKey(fileId),
        ContentType: 'audio/mpeg',
    }));
    if (!upload.UploadId) {
        throw new Error('Failed to start multipart upload');
    }

    await synthesize({ fileId, uploadId: upload.UploadId, nextChunk: 0, parts: [] }, text, context);
};

const continueProcessing = async (message: ContinuationMessage, context: Context): Promise<void> => {
    const response = await s3Client.send(new GetObjectCommand({
        Bucket: config.OUTPUT_BUCKET,
        Key: textKey(message.fileId),
    }));
    const text = await response.Body?.transformToString();
    if (!text) {
        throw new Error('Extracted text not found for continuation');
    }

    await synthesize(message, text, context);
};

export const handler: SQSHandler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
    logger.info('Polly Event Processor triggered', {
        requestId: context.awsRequestId,
        recordCount: event.Records.length,
    });

    const batchItemFailures: { itemIdentifier: string }[] = [];

    for (const record of event.Records) {
        const messageId = record.messageId;
        const receiveCount = Number(record.attributes.ApproximateReceiveCount);

        let message: ProcessorMessage;
        try {
            message = processorMessageSchema.parse(JSON.parse(record.body));
        } catch (error) {
            logger.error('Failed to parse or validate queue message', {
                messageId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            batchItemFailures.push({ itemIdentifier: messageId });
            continue;
        }

        const fileId = 'type' in message
            ? message.fileId
            : message.key.split('/').pop()?.split('.')[0] as string;

        logger.info('Processing message from queue', { fileId, messageId, receiveCount, message });

        try {
            if ('type' in message) {
                await continueProcessing(message, context);
            } else {
                await startProcessing(message, fileId, context);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            if (error instanceof UnprocessableFileError) {
                // Retrying won't help - record the failure so the user sees it
                logger.warn('File cannot be processed', { fileId, messageId, reason: errorMessage });
                try {
                    await writeStatus(fileId, { state: 'failed', reason: errorMessage });
                } catch (statusError) {
                    logger.error('Failed to write failure status', { fileId, error: statusError });
                    batchItemFailures.push({ itemIdentifier: messageId });
                }
                continue;
            }

            logger.error('Error processing file', {
                fileId,
                messageId,
                receiveCount,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            });

            if (receiveCount >= MAX_RECEIVE_COUNT) {
                // Last attempt before the DLQ - let the user know it failed
                await writeStatus(fileId, {
                    state: 'failed',
                    reason: 'Processing failed after several attempts. Please try again later.',
                }).catch((statusError) => logger.error('Failed to write failure status', { fileId, error: statusError }));
            }

            batchItemFailures.push({ itemIdentifier: messageId });
        }
    }

    return {
        batchItemFailures,
    };
};
