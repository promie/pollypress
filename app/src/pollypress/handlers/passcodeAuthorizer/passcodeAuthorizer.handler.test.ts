const send = jest.fn();

jest.mock('@aws-sdk/client-secrets-manager', () => ({
    SecretsManagerClient: jest.fn(() => ({ send })),
    GetSecretValueCommand: jest.fn(),
}));

process.env.PASSCODE_SECRET_ARN = 'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:passcode';

import type { APIGatewayTokenAuthorizerEvent, Callback, Context } from 'aws-lambda';
import { handler } from './passcodeAuthorizer.handler';

const methodArn = 'arn:aws:execute-api:ap-southeast-2:123456789012:abc123/staging/POST/upload';

const invoke = (authorizationToken: string) =>
    handler(
        { type: 'TOKEN', authorizationToken, methodArn } as APIGatewayTokenAuthorizerEvent,
        {} as Context,
        (() => {}) as Callback
    );

describe('passcode authorizer', () => {
    beforeAll(() => send.mockResolvedValue({ SecretString: 'correct-horse\n' }));

    it('allows every method on the stage for the right passcode', async () => {
        const result = await invoke('Passcode correct-horse');

        expect(result).toMatchObject({
            principalId: 'passcode-user',
            policyDocument: {
                Statement: [{
                    Effect: 'Allow',
                    Resource: 'arn:aws:execute-api:ap-southeast-2:123456789012:abc123/staging/*/*',
                }],
            },
        });
    });

    it('rejects a wrong passcode', async () => {
        await expect(invoke('Passcode wrong')).rejects.toThrow('Unauthorized');
    });

    it('rejects an empty header', async () => {
        await expect(invoke('Passcode ')).rejects.toThrow('Unauthorized');
    });

    it('caches the secret between calls', async () => {
        await invoke('Passcode correct-horse');
        await invoke('Passcode correct-horse');
        expect(send).toHaveBeenCalledTimes(1);
    });
});
