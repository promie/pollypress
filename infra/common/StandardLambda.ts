import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunctionProps, LogLevel, NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export const defaultBundling = {
    minify: true,
    sourceMap: true,
    target: 'es2020',
    logLevel: LogLevel.INFO,
    keepNames: true,
};

export class StandardLambda extends NodejsFunction {
    constructor(
        scope: Construct,
        id: string,
        { appName, ...props }: NodejsFunctionProps & Required<Pick<NodejsFunctionProps, 'entry'>> & { appName: string }
    ) {
        super(scope, id, {
            runtime: Runtime.NODEJS_22_X,
            functionName: `${appName}-${id}`,
            timeout: Duration.minutes(5),
            memorySize: 512,
            bundling: {
                ...defaultBundling,
                ...props.bundling,
            },
            tracing: Tracing.ACTIVE,
            ...props,
        });

        // CDK-managed log groups are retained by default; with fixed function
        // names a leftover group blocks redeploying after `cdk destroy`
        const logGroup = this.node.tryFindChild('LogGroup');
        if (logGroup instanceof LogGroup) {
            logGroup.applyRemovalPolicy(RemovalPolicy.DESTROY);
        }
    }
}