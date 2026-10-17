import { Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { StandardLambda } from '../../../../common/StandardLambda';
import { StandardRestApi } from '../../../../common/StandardRestApi';
import type { Config as UploadConfig } from '../../../../../app/src/pollypress/handlers/uploadApi/config';
import type { Config as DownloadConfig } from '../../../../../app/src/pollypress/handlers/downloadApi/config';
import type { Config as AuthorizerConfig } from '../../../../../app/src/pollypress/handlers/passcodeAuthorizer/config';

export type UploadApiConstructProps = {
    appName: string;
    stage: string;
    inputBucket: s3.Bucket;
    outputBucket: s3.Bucket;
    domainName?: string;
    subdomain?: string;
    certificate?: acm.ICertificate;
};

export class UploadApiConstruct extends Construct {
    public readonly api: apigateway.RestApi;
    public readonly uploadHandler: lambda.Function;
    public readonly downloadHandler: lambda.Function;
    public readonly apiUrl: string;
    public readonly passcodeSecret: secretsmanager.Secret;

    constructor(scope: Construct, id: string, props: UploadApiConstructProps) {
        super(scope, id);

        const { appName, stage, inputBucket, outputBucket, domainName, subdomain, certificate } = props;

        this.uploadHandler = new StandardLambda(this, 'UploadHandler', {
            appName,
            entry: 'app/src/pollypress/handlers/uploadApi/uploadApi.handler.ts',
            handler: 'handler',
            memorySize: 256,
            timeout: Duration.seconds(30),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
            } satisfies UploadConfig,
        });

        inputBucket.grantPut(this.uploadHandler);

        this.downloadHandler = new StandardLambda(this, 'DownloadHandler', {
            appName,
            entry: 'app/src/pollypress/handlers/downloadApi/downloadApi.handler.ts',
            handler: 'handler',
            memorySize: 256,
            timeout: Duration.seconds(30),
            environment: {
                OUTPUT_BUCKET: outputBucket.bucketName,
            } satisfies DownloadConfig,
        });

        outputBucket.grantRead(this.downloadHandler);

        const restApi = new StandardRestApi(this, 'RestApi', {
            appName,
            stage,
            domainName,
            subdomain,
            certificate,
            // Site-wide limits to slow down abuse; the daily character cap is the hard ceiling
            throttlingRateLimit: 20,
            throttlingBurstLimit: 40,
            methodOptions: {
                // Each upload triggers paid Polly work
                '/upload/POST': { throttlingRateLimit: 1, throttlingBurstLimit: 3 },
            },
        });

        this.api = restApi.api;
        this.apiUrl = restApi.apiUrl;

        // Shared passcode required for upload/download. Generated on first deploy;
        // replace it any time with `aws secretsmanager put-secret-value`
        this.passcodeSecret = new secretsmanager.Secret(this, 'PasscodeSecret', {
            secretName: `${appName}-${stage}-passcode`,
            description: 'Shared passcode for the PollyPress web app',
            generateSecretString: {
                passwordLength: 20,
                excludePunctuation: true,
                includeSpace: false,
            },
        });

        const authorizerHandler = new StandardLambda(this, 'PasscodeAuthorizer', {
            appName,
            entry: 'app/src/pollypress/handlers/passcodeAuthorizer/passcodeAuthorizer.handler.ts',
            handler: 'handler',
            memorySize: 256,
            timeout: Duration.seconds(10),
            environment: {
                PASSCODE_SECRET_ARN: this.passcodeSecret.secretArn,
            } satisfies AuthorizerConfig,
        });

        this.passcodeSecret.grantRead(authorizerHandler);

        const authorizer = new apigateway.TokenAuthorizer(this, 'PasscodeTokenAuthorizer', {
            handler: authorizerHandler,
            identitySource: apigateway.IdentitySource.header('Authorization'),
            resultsCacheTtl: Duration.minutes(5),
        });

        const protectedMethod: apigateway.MethodOptions = {
            authorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        };

        // API Gateway's own errors (bad passcode, throttling) don't include CORS
        // headers by default, so the browser couldn't read them
        const corsHeaders = {
            'Access-Control-Allow-Origin': "'*'",
            'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
        };
        this.api.addGatewayResponse('Default4xx', { type: apigateway.ResponseType.DEFAULT_4XX, responseHeaders: corsHeaders });
        this.api.addGatewayResponse('Default5xx', { type: apigateway.ResponseType.DEFAULT_5XX, responseHeaders: corsHeaders });

        const upload = this.api.root.addResource('upload');

        // /upload endpoint
        upload.addMethod('POST', new apigateway.LambdaIntegration(this.uploadHandler), protectedMethod);

        const download = this.api.root.addResource('download');

        // /download endpoint
        download.addMethod('GET', new apigateway.LambdaIntegration(this.downloadHandler), protectedMethod);

        // /auth/check endpoint - lets the frontend verify a passcode before using it
        const authCheck = this.api.root.addResource('auth').addResource('check');
        authCheck.addMethod('GET', new apigateway.MockIntegration({
            integrationResponses: [{
                statusCode: '200',
                responseParameters: {
                    'method.response.header.Access-Control-Allow-Origin': "'*'",
                },
                responseTemplates: {
                    'application/json': JSON.stringify({ message: 'Passcode accepted' }),
                },
            }],
            requestTemplates: {
                'application/json': '{"statusCode": 200}',
            },
        }), {
            ...protectedMethod,
            methodResponses: [{
                statusCode: '200',
                responseParameters: { 'method.response.header.Access-Control-Allow-Origin': true },
            }],
        });

        // /status endpoint (to check API health)
        const status = this.api.root.addResource('status');
        status.addMethod('GET', new apigateway.MockIntegration({
            integrationResponses: [{
                statusCode: '200',
                responseTemplates: {
                    'application/json': JSON.stringify({ message: 'API is healthy' }),
                },
            }],
            requestTemplates: {
                'application/json': '{"statusCode": 200}',
            },
        }), {
            methodResponses: [{ statusCode: '200' }],
        });
    }
}
