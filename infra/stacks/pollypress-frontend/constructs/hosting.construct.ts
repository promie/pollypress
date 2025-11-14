import { Construct } from 'constructs';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';

export type FrontendHostingProps = {
    appName: string;
    apiUrl: string;
    domainName?: string;
    subdomain?: string;
    certificate?: acm.ICertificate;
};

export class FrontendHostingConstruct extends Construct {
    public readonly distribution: cloudfront.Distribution;
    public readonly bucket: s3.Bucket;
    public readonly customDomain?: string;

    constructor(scope: Construct, id: string, props: FrontendHostingProps) {
        super(scope, id);

        const { domainName, subdomain, certificate } = props;
        const fullDomain = domainName && subdomain ? `${subdomain}.${domainName}` : undefined;
        this.customDomain = fullDomain;

        this.bucket = new s3.Bucket(this, 'FrontendBucket', {
            bucketName: `${props.appName.toLowerCase()}-frontend`,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        let hostedZone: route53.IHostedZone | undefined;
        if (domainName && subdomain && fullDomain) {
            hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
                domainName: domainName,
            });
        }

        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultRootObject: 'index.html',
            domainNames: fullDomain ? [fullDomain] : undefined,
            certificate: certificate,
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

        if (hostedZone && fullDomain) {
            new route53.ARecord(this, 'AliasRecord', {
                zone: hostedZone,
                recordName: subdomain,
                target: route53.RecordTarget.fromAlias(
                    new targets.CloudFrontTarget(this.distribution)
                ),
            });
        }

        new s3deploy.BucketDeployment(this, 'DeployFrontend', {
            sources: [s3deploy.Source.asset('./frontend/dist')],
            destinationBucket: this.bucket,
            distribution: this.distribution,
            distributionPaths: ['/*'],
        });
    }
}
