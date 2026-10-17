import { S3Client, GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';
import { PollyClient, GetSpeechSynthesisTaskCommand } from '@aws-sdk/client-polly';
import { createLogger } from '../../../common/logger';
import { audioKey, jobStatusSchema, statusKey } from '../../../common/jobStatus';

const logger = createLogger('get-job-status');
const s3Client = new S3Client({});
const pollyClient = new PollyClient({});

export type JobStatusResult =
    | { state: 'pending' }
    | { state: 'failed'; reason: string }
    | { state: 'completed'; audioKey: string; truncated: boolean };

/**
 * Resolves the processing state of an uploaded file from the status marker
 * written by the processor and the Polly synthesis task it started.
 */
export async function getJobStatus(input: { fileId: string; bucketName: string }): Promise<JobStatusResult> {
    const { fileId, bucketName } = input;

    let rawStatus: string | undefined;
    try {
        const response = await s3Client.send(new GetObjectCommand({
            Bucket: bucketName,
            Key: statusKey(fileId),
        }));
        rawStatus = await response.Body?.transformToString();
    } catch (error) {
        if (error instanceof NoSuchKey) {
            // Processor hasn't picked the file up yet
            return { state: 'pending' };
        }
        throw error;
    }

    const status = jobStatusSchema.parse(JSON.parse(rawStatus ?? '{}'));

    if (status.state === 'failed') {
        return { state: 'failed', reason: status.reason };
    }

    const { SynthesisTask } = await pollyClient.send(new GetSpeechSynthesisTaskCommand({
        TaskId: status.taskId,
    }));

    logger.info('Polly task status', { fileId, taskId: status.taskId, taskStatus: SynthesisTask?.TaskStatus });

    switch (SynthesisTask?.TaskStatus) {
        case 'completed':
            return { state: 'completed', audioKey: audioKey(fileId, status.taskId), truncated: status.truncated };
        case 'failed':
            return { state: 'failed', reason: SynthesisTask.TaskStatusReason ?? 'Speech synthesis failed' };
        default:
            return { state: 'pending' };
    }
}
