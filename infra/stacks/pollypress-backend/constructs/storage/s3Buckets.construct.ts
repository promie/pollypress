import { RemovalPolicy, Duration } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export type S3BucketsConstructProps = {
    appName: string;
    stage: string;
};

export class S3BucketsConstruct extends Construct {
    public readonly inputBucket: s3.Bucket;
    public readonly outputBucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: S3BucketsConstructProps) {
        super(scope, id);

        const { appName, stage } = props;

        this.inputBucket = new s3.Bucket(this, 'InputBucket', {
            bucketName: `${appName.toLowerCase()}-${stage}-input`,
            cors: [
                {
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.HEAD,
                    ],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                    exposedHeaders: ['ETag'],
                },
            ],
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true, 
            lifecycleRules: [
                {
                    id: 'DeleteOldInputFiles',
                    enabled: true,
                    expiration: Duration.days(7),
                },
            ],
        });

        // Output bucket for audio files
        this.outputBucket = new s3.Bucket(this, 'OutputBucket', {
            bucketName: `${appName.toLowerCase()}-${stage}-output`,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                },
            ],
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            lifecycleRules: [
                {
                    id: 'DeleteOldOutputFiles',
                    enabled: true,
                    expiration: Duration.days(30), 
                },
            ],
        });
    }
}
