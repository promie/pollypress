import { S3Client, GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';
import { jobStatusSchema, statusKey, type JobStatus } from '../../../common/jobStatus';

const s3Client = new S3Client({});

export type JobStatusResult = JobStatus | { state: 'pending' };

/**
 * Reads the status marker the processor writes for an uploaded file.
 * Returns `pending` until the processor has picked the file up.
 */
export async function getJobStatus(input: { fileId: string; bucketName: string }): Promise<JobStatusResult> {
    const { fileId, bucketName } = input;

    try {
        const response = await s3Client.send(new GetObjectCommand({
            Bucket: bucketName,
            Key: statusKey(fileId),
        }));
        const rawStatus = await response.Body?.transformToString();
        return jobStatusSchema.parse(JSON.parse(rawStatus ?? '{}'));
    } catch (error) {
        if (error instanceof NoSuchKey) {
            return { state: 'pending' };
        }
        throw error;
    }
}
