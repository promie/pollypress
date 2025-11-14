import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

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

        const { domainName, subdomain } = props;
        const customDomain = domainName && subdomain ? `${subdomain}.${domainName}` : undefined;

        this.apiUrl = customDomain ? `https://${customDomain}` : '';

        if (this.apiUrl) {
            new CfnOutput(this, 'ApiUrl', {
                value: this.apiUrl,
                description: 'API Gateway URL',
            });

            new CfnOutput(this, 'CustomDomain', {
                value: customDomain!,
                description: 'API Custom Domain',
            });
        }
    }
}
