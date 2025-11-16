import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { ApiGatewayDomainConstruct } from '../stacks/pollypress-backend/constructs/common/apiGatewayDomain.construct';

export type StandardRestApiProps = {
    appName: string;
    stage: string;
    description?: string;
    domainName?: string;
    subdomain?: string;
    certificate?: acm.ICertificate;
    corsAllowOrigins?: string[];
    corsAllowMethods?: string[];
    corsAllowHeaders?: string[];
    tracingEnabled?: boolean;
    loggingLevel?: apigateway.MethodLoggingLevel;
    dataTraceEnabled?: boolean;
    metricsEnabled?: boolean;
};

export class StandardRestApi extends Construct {
    public readonly api: apigateway.RestApi;
    public readonly apiUrl: string;

    constructor(scope: Construct, id: string, props: StandardRestApiProps) {
        super(scope, id);

        const {
            appName,
            stage,
            description,
            domainName,
            subdomain,
            certificate,
            corsAllowOrigins = apigateway.Cors.ALL_ORIGINS,
            corsAllowMethods = apigateway.Cors.ALL_METHODS,
            corsAllowHeaders = ['Content-Type', 'Authorization'],
            tracingEnabled = true,
            loggingLevel = apigateway.MethodLoggingLevel.INFO,
            dataTraceEnabled = true,
            metricsEnabled = true,
        } = props;

        this.api = new apigateway.RestApi(this, 'Api', {
            restApiName: `${appName}-${stage}-api`,
            description: description || `${appName} API (${stage})`,
            deployOptions: {
                stageName: stage,
                tracingEnabled,
                loggingLevel,
                dataTraceEnabled,
                metricsEnabled,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: corsAllowOrigins,
                allowMethods: corsAllowMethods,
                allowHeaders: corsAllowHeaders,
            },
        });

        const customDomain = domainName && subdomain ? `${subdomain}.${domainName}` : undefined;

        if (customDomain && certificate && domainName) {
            const domainConfig = new ApiGatewayDomainConstruct(this, 'DomainConfig', {
                api: this.api,
                customDomain,
                baseDomain: domainName,
                certificate,
            });
            this.apiUrl = domainConfig.apiUrl;
        } else {
            this.apiUrl = this.api.url;
        }
    }
}
