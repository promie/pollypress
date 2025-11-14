import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { FrontendHostingConstruct } from './constructs/hosting.construct';

export type PollyPressFrontendStackProps = StackProps & {
    appName: string;
    stage: string;
    apiUrl: string;
};

export class PollyPressFrontendStack extends Stack {
    constructor(scope: Construct, id: string, props: PollyPressFrontendStackProps) {
        super(scope, id, props);

        const { appName, apiUrl } = props;

        const frontend = new FrontendHostingConstruct(this, 'Frontend', {
            appName,
            apiUrl,
        });

        new CfnOutput(this, 'FrontendUrl', {
            value: `https://${frontend.distribution.distributionDomainName}`,
            description: 'Frontend CloudFront URL',
        });

        new CfnOutput(this, 'FrontendBucket', {
            value: frontend.bucket.bucketName,
            description: 'Frontend S3 Bucket',
        });
    }
}
