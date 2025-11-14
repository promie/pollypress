import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export type PollyPressBackendStackProps = StackProps & {
    appName: string;
    stage: string;
};

export class PollyPressBackendStack extends Stack {
    public readonly apiUrl: string;

    constructor(scope: Construct, id: string, props: PollyPressBackendStackProps) {
        super(scope, id, props);

        const { appName } = props;

        this.apiUrl = 'https://placeholder-api-url.com';

        new CfnOutput(this, 'ApiUrl', {
            value: this.apiUrl,
            description: 'API Gateway URL',
        });
    }
}
