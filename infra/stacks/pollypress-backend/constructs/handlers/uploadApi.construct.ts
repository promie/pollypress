import { Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { StandardLambda } from '../../../../common/StandardLambda';
import { StandardRestApi } from '../../../../common/StandardRestApi';
import type { Config } from '../../../../../app/src/pollypress/handlers/uploadApi/config';

export type UploadApiConstructProps = {
    appName: string;
    stage: string;
    inputBucket: s3.Bucket;
    domainName?: string;
    subdomain?: string;
    certificate?: acm.ICertificate;
};

export class UploadApiConstruct extends Construct {
    public readonly api: apigateway.RestApi;
    public readonly uploadHandler: lambda.Function;
    public readonly apiUrl: string;

    constructor(scope: Construct, id: string, props: UploadApiConstructProps) {
        super(scope, id);

        const { appName, stage, inputBucket, domainName, subdomain, certificate } = props;

        this.uploadHandler = new StandardLambda(this, 'UploadHandler', {
            appName,
            entry: 'app/src/pollypress/handlers/uploadApi/uploadApi.handler.ts',
            handler: 'handler',
            memorySize: 256,
            timeout: Duration.seconds(30),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
            } satisfies Config,
        });

        inputBucket.grantPut(this.uploadHandler);

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
