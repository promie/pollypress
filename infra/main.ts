#!/usr/bin/env node
import 'source-map-support/register';
import { App, StackProps } from 'aws-cdk-lib';
import { PollyPressBackendStack } from './stacks/pollypress-backend/stack';
import { PollyPressFrontendStack } from './stacks/pollypress-frontend/stack';

const {
    CDK_DEPLOY_ACCOUNT = process.env.CDK_DEFAULT_ACCOUNT,
    CDK_DEPLOY_REGION = process.env.CDK_DEFAULT_REGION,
    APP_NAME = 'PollyPress',
    STAGE = process.env.NODE_ENV || 'staging',
} = process.env;

const baseProps: StackProps = {
    env: {
        account: CDK_DEPLOY_ACCOUNT,
        region: CDK_DEPLOY_REGION,
    },
};

const app = new App();

const backendStack = new PollyPressBackendStack(app, `${APP_NAME}BackendStack`, {
    ...baseProps,
    stackName: `${APP_NAME}-Backend-${STAGE}`,
    appName: APP_NAME,
    stage: STAGE,
});

new PollyPressFrontendStack(app, `${APP_NAME}FrontendStack`, {
    ...baseProps,
    stackName: `${APP_NAME}-Frontend-${STAGE}`,
    appName: APP_NAME,
    stage: STAGE,
    apiUrl: backendStack.apiUrl,
});
