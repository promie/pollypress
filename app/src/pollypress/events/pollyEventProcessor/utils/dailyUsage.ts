import {
    DynamoDBClient,
    TransactWriteItemsCommand,
    TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

// Usage records expire a few days after the day they count
const RECORD_TTL_SECONDS = 3 * 24 * 60 * 60;

export type ReserveResult =
    | { status: 'reserved' }
    | { status: 'already-reserved' }
    | { status: 'limit-reached'; usedToday: number };

/** Start of the next UTC day, when the daily allowance resets. */
export function nextDailyReset(now = new Date()): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

// Polly's neural voices speak at roughly 15 characters per second
export const CHARACTERS_PER_MINUTE = 900;

/** Approximate spoken length of `characters` of text, e.g. "about 1 hour 20 minutes". */
export function describeAudioLength(characters: number): string {
    const totalMinutes = Math.max(1, Math.round(characters / CHARACTERS_PER_MINUTE));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const parts = [
        hours > 0 ? `${hours} hour${hours === 1 ? '' : 's'}` : '',
        minutes > 0 ? `${minutes} minute${minutes === 1 ? '' : 's'}` : '',
    ].filter(Boolean);

    return `about ${parts.join(' ')}`;
}

/**
 * Atomically adds `characters` to today's (UTC) usage total, refusing if it
 * would exceed `dailyLimit`. A per-file marker makes this idempotent, so a
 * retried message never counts the same document twice.
 */
export async function reserveDailyCharacters(input: {
    tableName: string;
    fileId: string;
    characters: number;
    dailyLimit: number;
}): Promise<ReserveResult> {
    const { tableName, fileId, characters, dailyLimit } = input;
    const day = new Date().toISOString().slice(0, 10);
    const expiresAt = Math.floor(Date.now() / 1000) + RECORD_TTL_SECONDS;

    try {
        await dynamoClient.send(new TransactWriteItemsCommand({
            TransactItems: [
                {
                    Put: {
                        TableName: tableName,
                        Item: {
                            pk: { S: `file#${fileId}` },
                            characters: { N: String(characters) },
                            expiresAt: { N: String(expiresAt) },
                        },
                        ConditionExpression: 'attribute_not_exists(pk)',
                    },
                },
                {
                    Update: {
                        TableName: tableName,
                        Key: { pk: { S: `day#${day}` } },
                        UpdateExpression: 'ADD characters :n SET expiresAt = :exp',
                        ConditionExpression: 'attribute_not_exists(characters) OR characters <= :remaining',
                        ExpressionAttributeValues: {
                            ':n': { N: String(characters) },
                            ':exp': { N: String(expiresAt) },
                            ':remaining': { N: String(dailyLimit - characters) },
                        },
                        // Return today's total if blocked, to tell the user what's left
                        ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
                    },
                },
            ],
        }));
        return { status: 'reserved' };
    } catch (error) {
        if (error instanceof TransactionCanceledException) {
            const [fileMarker, dayTotal] = error.CancellationReasons ?? [];
            if (fileMarker?.Code === 'ConditionalCheckFailed') {
                return { status: 'already-reserved' };
            }
            if (dayTotal?.Code === 'ConditionalCheckFailed') {
                return { status: 'limit-reached', usedToday: Number(dayTotal.Item?.characters?.N ?? 0) };
            }
        }
        throw error;
    }
}
