import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLogger } from '../../../common/logger';

const logger = createLogger('generate-presigned-download-url');
const s3Client = new S3Client({});

export type GeneratePresignedDownloadUrlInput = {
    fileKey: string;
    bucketName: string;
};

export type GeneratePresignedDownloadUrlOutput = {
    downloadUrl: string;
    fileKey: string;
    expiresIn: number;
};

export async function generatePresignedDownloadUrl(
    input: GeneratePresignedDownloadUrlInput
): Promise<GeneratePresignedDownloadUrlOutput> {
    const { fileKey, bucketName } = input;

    logger.info('Generating presigned download URL', { fileKey, bucketName });

    // First check if the file exists
    try {
        const headCommand = new HeadObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
        });
        await s3Client.send(headCommand);
    } catch (error) {
        logger.error('File not found in output bucket', { fileKey, error });
        throw new Error('Audio file not found. Processing may still be in progress.');
    }

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
    });

    const expiresIn = 3600; // 1 hour
    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    logger.info('Presigned download URL generated successfully', {
        fileKey,
        expiresIn,
    });

    return {
        downloadUrl,
        fileKey,
        expiresIn,
    };
}
