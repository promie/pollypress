import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { S3BucketsConstruct } from './constructs/storage/s3Buckets.construct';
import { UploadApiConstruct } from './constructs/handlers/uploadApi.construct';
import { PollyPressEventConstruct } from './constructs/events/pollyPressEvent.construct';

export type PollyPressBackendStackProps = StackProps & {
    appName: string;
    stage: string;
    domainName?: string;
    subdomain?: string;
    certificate?: acm.ICertificate;
};

export class PollyPressBackendStack extends Stack {
    public readonly apiUrl: string;

    constructor(scope: Construct, id: string, props: PollyPressBackendStackProps) {
        super(scope, id, props);

        const { appName, stage, domainName, subdomain, certificate } = props;

        const storage = new S3BucketsConstruct(this, 'Storage', {
            appName,
            stage,
        });

        const api = new UploadApiConstruct(this, 'Api', {
            appName,
            stage,
            inputBucket: storage.inputBucket,
            outputBucket: storage.outputBucket,
            domainName,
            subdomain,
            certificate,
        });

        new PollyPressEventConstruct(this, 'PollyPressEvent', {
            appName,
            stage,
            inputBucket: storage.inputBucket,
            outputBucket: storage.outputBucket,
        });

        this.apiUrl = api.apiUrl;

        new CfnOutput(this, 'ApiUrl', {
            value: this.apiUrl,
            description: 'API Gateway URL',
        });

        new CfnOutput(this, 'InputBucket', {
            value: storage.inputBucket.bucketName,
            description: 'Input S3 Bucket',
        });

        new CfnOutput(this, 'OutputBucket', {
            value: storage.outputBucket.bucketName,
            description: 'Output S3 Bucket',
        });

        if (domainName && subdomain) {
            new CfnOutput(this, 'CustomDomain', {
                value: `${subdomain}.${domainName}`,
                description: 'API Custom Domain',
            });
        }
    }
}
