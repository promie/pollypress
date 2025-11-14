import { Construct } from 'constructs';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export type FrontendHostingProps = {
    appName: string;
    apiUrl: string;
};

export class FrontendHostingConstruct extends Construct {
    public readonly distribution: cloudfront.Distribution;
    public readonly bucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: FrontendHostingProps) {
        super(scope, id);

        this.bucket = new s3.Bucket(this, 'FrontendBucket', {
            bucketName: `${props.appName.toLowerCase()}-frontend`,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultRootObject: 'index.html',
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: Duration.seconds(0),
                },
            ],
        });

        new s3deploy.BucketDeployment(this, 'DeployFrontend', {
            sources: [s3deploy.Source.asset('../frontend/dist')],
            destinationBucket: this.bucket,
            distribution: this.distribution,
            distributionPaths: ['/*'],
        });
    }
}
