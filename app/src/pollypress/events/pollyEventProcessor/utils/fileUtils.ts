import { Readable } from 'stream';
import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';
import type { FailureCode } from '../../../common/jobStatus';

/**
 * Error for inputs that will never succeed (bad file type, no text, etc.).
 * These are reported to the user instead of being retried.
 */
export class UnprocessableFileError extends Error {
    readonly code?: FailureCode;
    readonly retryAt?: string;

    constructor(message: string, details: { code?: FailureCode; retryAt?: string } = {}) {
        super(message);
        this.name = 'UnprocessableFileError';
        this.code = details.code;
        this.retryAt = details.retryAt;
    }
}

export async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

export async function extractText(fileContent: Buffer, fileKey: string): Promise<string> {
    const extension = fileKey.split('.').pop()?.toLowerCase();

    if (extension === 'txt') {
        return fileContent.toString('utf-8');
    }

    if (extension === 'pdf') {
        let text: string;
        try {
            const pdf = await getDocumentProxy(new Uint8Array(fileContent));
            ({ text } = await extractPdfText(pdf, { mergePages: true }));
        } catch (error) {
            throw new UnprocessableFileError(
                `Could not read PDF: ${error instanceof Error ? error.message : 'unknown error'}`
            );
        }
        return text;
    }

    throw new UnprocessableFileError(`Unsupported file type: ${extension}. Only .txt and .pdf files are supported.`);
}

/**
 * Collapses whitespace (PDF extraction leaves lots of line breaks).
 */
export function normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}
