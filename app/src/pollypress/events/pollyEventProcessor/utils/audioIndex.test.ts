const send = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn(() => ({ send })),
    GetItemCommand: jest.fn((input) => input),
    PutItemCommand: jest.fn((input) => input),
}));

import { findIndexedAudio, hashText } from './audioIndex';

const now = Math.floor(Date.now() / 1000);

describe('hashText', () => {
    it('is stable for identical text and differs for edited text', () => {
        expect(hashText('Chapter one.')).toBe(hashText('Chapter one.'));
        expect(hashText('Chapter one.')).not.toBe(hashText('Chapter one!'));
    });
});

describe('findIndexedAudio', () => {
    beforeEach(() => send.mockReset());

    it('returns audio that is still within its lifetime', async () => {
        send.mockResolvedValue({
            Item: {
                fileId: { S: 'abc' },
                audioKey: { S: 'output/abc/audio.mp3' },
                convertedAt: { S: '2026-10-17T12:17:00.000Z' },
                expiresAt: { N: String(now + 3600) },
            },
        });

        await expect(findIndexedAudio({ tableName: 't', textHash: 'h' })).resolves.toEqual({
            fileId: 'abc',
            audioKey: 'output/abc/audio.mp3',
            convertedAt: '2026-10-17T12:17:00.000Z',
        });
    });

    it('ignores expired entries that TTL has not removed yet', async () => {
        send.mockResolvedValue({
            Item: {
                fileId: { S: 'abc' },
                audioKey: { S: 'output/abc/audio.mp3' },
                convertedAt: { S: '2026-09-01T00:00:00.000Z' },
                expiresAt: { N: String(now - 60) },
            },
        });

        await expect(findIndexedAudio({ tableName: 't', textHash: 'h' })).resolves.toBeNull();
    });

    it('returns null when the text was never converted', async () => {
        send.mockResolvedValue({});
        await expect(findIndexedAudio({ tableName: 't', textHash: 'h' })).resolves.toBeNull();
    });
});
