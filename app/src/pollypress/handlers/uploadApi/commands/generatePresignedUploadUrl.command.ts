import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { createLogger } from '../../../common/logger';

const logger = createLogger('generate-presigned-url-command');
const s3Client = new S3Client({});

export type GeneratePresignedUploadUrlInput = {
    fileName: string;
    fileType: string;
    bucketName: string;
};

export type GeneratePresignedUploadUrlOutput = {
    uploadUrl: string;
    fileId: string;
    fileKey: string;
};

/**
 * Generates a presigned URL for uploading a file directly to S3
 *
 * @param input - File details and bucket information
 * @returns Presigned URL, file ID, and S3 key
 */
export async function generatePresignedUploadUrl(
    input: GeneratePresignedUploadUrlInput
): Promise<GeneratePresignedUploadUrlOutput> {
    const { fileName, fileType, bucketName } = input;

    logger.info('Generating presigned URL', { fileName, fileType });

    // Generate unique file ID
    const fileId = randomUUID();
    const fileExtension = fileName.split('.').pop();
    const fileKey = `input/${fileId}.${fileExtension}`;

    // Create S3 PutObject command
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        ContentType: fileType,
    });

    // Generate presigned URL (15 minutes expiry)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    logger.info('Presigned URL generated successfully', { fileId, fileKey });

    return {
        uploadUrl,
        fileId,
        fileKey,
    };
}
