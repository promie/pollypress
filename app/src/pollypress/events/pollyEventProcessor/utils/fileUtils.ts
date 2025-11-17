import { Readable } from 'stream';

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

    throw new Error(`Unsupported file type: ${extension}. Currently only .txt files are supported.`);
}

