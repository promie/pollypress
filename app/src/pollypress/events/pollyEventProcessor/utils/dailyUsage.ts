import {
    DynamoDBClient,
    TransactWriteItemsCommand,
    TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

// Usage records expire a few days after the day they count
const RECORD_TTL_SECONDS = 3 * 24 * 60 * 60;

export type ReserveResult = 'reserved' | 'already-reserved' | 'limit-reached';

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
                    },
                },
            ],
        }));
        return 'reserved';
    } catch (error) {
        if (error instanceof TransactionCanceledException) {
            const [fileMarker, dayTotal] = error.CancellationReasons ?? [];
            if (fileMarker?.Code === 'ConditionalCheckFailed') {
                return 'already-reserved';
            }
            if (dayTotal?.Code === 'ConditionalCheckFailed') {
                return 'limit-reached';
            }
        }
        throw error;
    }
}
