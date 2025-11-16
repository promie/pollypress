import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export type ApiGatewayDomainConstructProps = {
    api: apigateway.RestApi;
    customDomain: string;
    baseDomain: string;
    certificate: acm.ICertificate;
};

export class ApiGatewayDomainConstruct extends Construct {
    public readonly domainName: apigateway.DomainName;
    public readonly apiUrl: string;

    constructor(scope: Construct, id: string, props: ApiGatewayDomainConstructProps) {
        super(scope, id);

        const { api, customDomain, baseDomain, certificate } = props;

        // Create API Gateway custom domain
        this.domainName = new apigateway.DomainName(this, 'CustomDomain', {
            domainName: customDomain,
            certificate: certificate,
            securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
        });

        // Map the custom domain to the API
        new apigateway.BasePathMapping(this, 'BasePathMapping', {
            domainName: this.domainName,
            restApi: api,
        });

        // Look up the hosted zone
        const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
            domainName: baseDomain,
        });

        // Create A record pointing to API Gateway
        new route53.ARecord(this, 'ApiAliasRecord', {
            zone: hostedZone,
            recordName: customDomain,
            target: route53.RecordTarget.fromAlias(
                new targets.ApiGatewayDomain(this.domainName)
            ),
        });

        this.apiUrl = `https://${customDomain}`;
    }
}
