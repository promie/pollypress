import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { FrontendHostingConstruct } from './constructs/hosting.construct';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

export type PollyPressFrontendStackProps = StackProps & {
    appName: string;
    stage: string;
    apiUrl: string;
    domainName?: string;
    subdomain?: string;
    certificate?: acm.ICertificate;
};

export class PollyPressFrontendStack extends Stack {
    constructor(scope: Construct, id: string, props: PollyPressFrontendStackProps) {
        super(scope, id, props);

        const { appName, apiUrl, domainName, subdomain, certificate } = props;

        const frontend = new FrontendHostingConstruct(this, 'Frontend', {
            appName,
            apiUrl,
            domainName,
            subdomain,
            certificate,
        });

        const frontendUrl = frontend.customDomain
            ? `https://${frontend.customDomain}`
            : `https://${frontend.distribution.distributionDomainName}`;

        new CfnOutput(this, 'FrontendUrl', {
            value: frontendUrl,
            description: 'Frontend URL',
        });

        new CfnOutput(this, 'FrontendBucket', {
            value: frontend.bucket.bucketName,
            description: 'Frontend S3 Bucket',
        });

        if (frontend.customDomain) {
            new CfnOutput(this, 'CustomDomain', {
                value: frontend.customDomain,
                description: 'Custom Domain',
            });
        }

        new CfnOutput(this, 'CloudFrontUrl', {
            value: `https://${frontend.distribution.distributionDomainName}`,
            description: 'CloudFront Distribution URL',
        });
    }
}
