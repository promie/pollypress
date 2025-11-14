import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export type PollyPressFrontendStackProps = StackProps & {
    appName: string;
    stage: string;
    apiUrl: string;
};

export class PollyPressFrontendStack extends Stack {
    constructor(scope: Construct, id: string, props: PollyPressFrontendStackProps) {
        super(scope, id, props);

        const { appName, apiUrl } = props;

        new CfnOutput(this, 'FrontendUrl', {
            value: 'https://placeholder-frontend-url.com',
            description: 'Frontend CloudFront URL',
        });
    }
}
