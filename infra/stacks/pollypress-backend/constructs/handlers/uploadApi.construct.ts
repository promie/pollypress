import { Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { StandardLambda } from '../../../../common/StandardLambda';
import { StandardRestApi } from '../../../../common/StandardRestApi';
import type { Config as UploadConfig } from '../../../../../app/src/pollypress/handlers/uploadApi/config';
import type { Config as DownloadConfig } from '../../../../../app/src/pollypress/handlers/downloadApi/config';

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
        });

        this.api = restApi.api;
        this.apiUrl = restApi.apiUrl;

        const upload = this.api.root.addResource('upload');

        // /upload endpoint
        upload.addMethod('POST', new apigateway.LambdaIntegration(this.uploadHandler));

        const download = this.api.root.addResource('download');

        // /download endpoint
        download.addMethod('GET', new apigateway.LambdaIntegration(this.downloadHandler));

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
