import { createHash } from 'crypto';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

// Output audio is deleted after 30 days; forget it a day earlier so we never
// point a duplicate at a file that's about to disappear
const INDEX_TTL_SECONDS = 29 * 24 * 60 * 60;

export type IndexedAudio = {
    fileId: string;
    audioKey: string;
    convertedAt: string;
};

/**
 * Identifies a document by its extracted text, so the same content is
 * recognised even if the file is renamed or re-exported.
 */
export const hashText = (text: string): string => createHash('sha256').update(text).digest('hex');

export async function findIndexedAudio(input: { tableName: string; textHash: string }): Promise<IndexedAudio | null> {
    const { Item } = await dynamoClient.send(new GetItemCommand({
        TableName: input.tableName,
        Key: { textHash: { S: input.textHash } },
    }));

    // TTL deletion can lag, so check expiry ourselves
    if (!Item || Number(Item.expiresAt?.N ?? 0) <= Date.now() / 1000) {
        return null;
    }

    return {
        fileId: Item.fileId.S as string,
        audioKey: Item.audioKey.S as string,
        convertedAt: Item.convertedAt.S as string,
    };
}

export async function indexAudio(input: {
    tableName: string;
    textHash: string;
    fileId: string;
    audioKey: string;
    // Defaults to now; the backfill passes the original conversion time
    convertedAt?: Date;
}): Promise<void> {
    const convertedAt = input.convertedAt ?? new Date();

    await dynamoClient.send(new PutItemCommand({
        TableName: input.tableName,
        Item: {
            textHash: { S: input.textHash },
            fileId: { S: input.fileId },
            audioKey: { S: input.audioKey },
            convertedAt: { S: convertedAt.toISOString() },
            expiresAt: { N: String(Math.floor(convertedAt.getTime() / 1000) + INDEX_TTL_SECONDS) },
        },
    }));
}
