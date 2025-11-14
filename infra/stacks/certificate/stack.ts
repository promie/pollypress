import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';

export type CertificateStackProps = StackProps & {
    domainName: string;
    subdomains: string[];
};

export class CertificateStack extends Stack {
    public readonly certificate: acm.Certificate;

    constructor(scope: Construct, id: string, props: CertificateStackProps) {
        super(scope, id, props);

        const { domainName, subdomains } = props;
        const fullDomains = subdomains.map(sub => `${sub}.${domainName}`);

        // Look up existing hosted zone
        const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
            domainName: domainName,
        });

        // Create certificate in us-east-1 (required for CloudFront)
        // Primary domain is the first subdomain, rest are SANs
        this.certificate = new acm.Certificate(this, 'Certificate', {
            domainName: fullDomains[0],
            subjectAlternativeNames: fullDomains.slice(1),
            validation: acm.CertificateValidation.fromDns(hostedZone),
        });
    }
}
