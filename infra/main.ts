#!/usr/bin/env node
import 'source-map-support/register';
import 'dotenv/config';
import { App, StackProps } from 'aws-cdk-lib';
import { PollyPressBackendStack } from './stacks/pollypress-backend/stack';
import { PollyPressFrontendStack } from './stacks/pollypress-frontend/stack';
import { CertificateStack } from './stacks/certificate/stack';

const {
    CDK_DEPLOY_ACCOUNT = process.env.CDK_DEFAULT_ACCOUNT,
    CDK_DEPLOY_REGION = process.env.CDK_DEFAULT_REGION,
    APP_NAME = 'PollyPress',
    STAGE = process.env.NODE_ENV || 'staging',
    DOMAIN_NAME,
    FRONTEND_SUBDOMAIN,
    BACKEND_SUBDOMAIN,
} = process.env;

const baseProps: StackProps = {
    env: {
        account: CDK_DEPLOY_ACCOUNT,
        region: CDK_DEPLOY_REGION,
    },
};

const app = new App();

let certificateStack;

if (DOMAIN_NAME && (FRONTEND_SUBDOMAIN || BACKEND_SUBDOMAIN)) {
    const subdomains = [FRONTEND_SUBDOMAIN, BACKEND_SUBDOMAIN].filter(Boolean) as string[];

    certificateStack = new CertificateStack(app, `${APP_NAME}CertificateStack`, {
        env: {
            account: CDK_DEPLOY_ACCOUNT,
            region: 'us-east-1', // CloudFront requires certificates in us-east-1
        },
        crossRegionReferences: true,
        stackName: `${APP_NAME}-Certificate-${STAGE}`,
        domainName: DOMAIN_NAME,
        subdomains: subdomains,
    });
}

const backendStack = new PollyPressBackendStack(app, `${APP_NAME}BackendStack`, {
    ...baseProps,
    stackName: `${APP_NAME}-Backend-${STAGE}`,
    appName: APP_NAME,
    stage: STAGE,
    domainName: DOMAIN_NAME,
    subdomain: BACKEND_SUBDOMAIN,
    certificate: certificateStack?.certificate,
});

new PollyPressFrontendStack(app, `${APP_NAME}FrontendStack`, {
    ...baseProps,
    crossRegionReferences: true,
    stackName: `${APP_NAME}-Frontend-${STAGE}`,
    appName: APP_NAME,
    stage: STAGE,
    apiUrl: backendStack.apiUrl,
    domainName: DOMAIN_NAME,
    subdomain: FRONTEND_SUBDOMAIN,
    certificate: certificateStack?.certificate,
});
