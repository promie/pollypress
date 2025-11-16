import { Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { StandardLambda } from '../../../../common/StandardLambda';
import { ApiGatewayDomainConstruct } from '../common/apiGatewayDomain.construct';

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
            },
        });

        inputBucket.grantPut(this.uploadHandler);

        this.api = new apigateway.RestApi(this, 'Api', {
            restApiName: `${appName}-${stage}-api`,
            description: `${appName} API (${stage})`,
            deployOptions: {
                stageName: stage,
                tracingEnabled: true,
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                metricsEnabled: true,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });

        const customDomain = domainName && subdomain ? `${subdomain}.${domainName}` : undefined;

        if (customDomain && certificate && domainName) {
            const domainConfig = new ApiGatewayDomainConstruct(this, 'DomainConfig', {
                api: this.api,
                customDomain,
                baseDomain: domainName,
                certificate,
            });
            this.apiUrl = domainConfig.apiUrl;
        } else {
            this.apiUrl = this.api.url;
        }

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
