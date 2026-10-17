import { APIGatewayTokenAuthorizerHandler, APIGatewayAuthorizerResult } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createHash, timingSafeEqual } from 'crypto';
import { createLogger } from '../../common/logger';
import { initConfig } from './config';

const logger = createLogger('passcode-authorizer');
const secretsClient = new SecretsManagerClient({});
const { PASSCODE_SECRET_ARN } = initConfig();

// Re-read the secret periodically so a changed passcode takes effect without a deploy
const SECRET_CACHE_MS = 5 * 60 * 1000;
let cachedPasscode: { value: string; fetchedAt: number } | null = null;

const getPasscode = async (): Promise<string> => {
    if (cachedPasscode && Date.now() - cachedPasscode.fetchedAt < SECRET_CACHE_MS) {
        return cachedPasscode.value;
    }

    const { SecretString } = await secretsClient.send(new GetSecretValueCommand({ SecretId: PASSCODE_SECRET_ARN }));
    if (!SecretString) {
        throw new Error('Passcode secret is empty');
    }

    cachedPasscode = { value: SecretString.trim(), fetchedAt: Date.now() };
    return cachedPasscode.value;
};

// Hashing first gives equal-length buffers, so the comparison is constant time
const matches = (provided: string, expected: string): boolean =>
    timingSafeEqual(
        createHash('sha256').update(provided).digest(),
        createHash('sha256').update(expected).digest(),
    );

/**
 * Allows API calls whose Authorization header is "Passcode <code>" with the
 * shared passcode stored in Secrets Manager.
 */
export const handler: APIGatewayTokenAuthorizerHandler = async (event): Promise<APIGatewayAuthorizerResult> => {
    const provided = event.authorizationToken.replace(/^Passcode\s+/i, '').trim();

    if (!provided || !matches(provided, await getPasscode())) {
        logger.warn('Rejected request with invalid passcode', { methodArn: event.methodArn });
        // API Gateway turns this exact message into a 401 response
        throw new Error('Unauthorized');
    }

    // Results are cached per passcode, so allow every method on this API stage,
    // not just the one that triggered the check.
    // methodArn: arn:aws:execute-api:<region>:<account>:<apiId>/<stage>/<METHOD>/<path>
    const [apiArn, stageName] = event.methodArn.split('/');
    const resource = `${apiArn}/${stageName}/*/*`;

    return {
        principalId: 'passcode-user',
        policyDocument: {
            Version: '2012-10-17',
            Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: resource }],
        },
    };
};
