import { Duration } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { StandardLambda } from '../../../../common/StandardLambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import type { Config as ReceiverConfig } from '../../../../../app/src/pollypress/events/pollyEventProcessor/receiver/config';
import type { Config as ProcessorConfig } from '../../../../../app/src/pollypress/events/pollyEventProcessor/processor/config';

export type PollyPressEventConstructProps = {
    appName: string;
    stage: string;
    inputBucket: s3.Bucket;
    outputBucket: s3.Bucket;
};

export class PollyPressEventConstruct extends Construct {
    public readonly receiverLambda: lambda.Function;
    public readonly processorLambda: lambda.Function;
    public readonly processingQueue: sqs.Queue;

    constructor(scope: Construct, id: string, props: PollyPressEventConstructProps) {
        super(scope, id);

        const { appName, stage, inputBucket, outputBucket } = props;
        const stackName = `${appName}-${stage}`;

        const deadLetterQueue = new sqs.Queue(this, 'PollyPressEventDLQ', {
            queueName: `${stackName}-PollyPress-Event-DLQ`,
            retentionPeriod: Duration.days(14),
        });

        const processingQueue = new sqs.Queue(this, 'PollyPressEventQueue', {
            queueName: `${stackName}-PollyPress-Event-Queue`,
            visibilityTimeout: Duration.seconds(330),
            retentionPeriod: Duration.days(4),
            deadLetterQueue: {
                queue: deadLetterQueue,
                maxReceiveCount: 3,
            },
        });

        this.processingQueue = processingQueue;

        this.receiverLambda = new StandardLambda(this, 'PollyPressEventReceiver', {
            appName,
            entry: 'app/src/pollypress/events/pollyEventProcessor/receiver/pollyEventReceiver.event.ts',
            handler: 'handler',
            memorySize: 256,
            timeout: Duration.seconds(30),
            environment: {
                PROCESSING_QUEUE_URL: processingQueue.queueUrl,
            } satisfies ReceiverConfig,
        });

        processingQueue.grantSendMessages(this.receiverLambda);

        this.processorLambda = new StandardLambda(this, 'PollyPressEventProcessor', {
            appName,
            entry: 'app/src/pollypress/events/pollyEventProcessor/processor/pollyEventProcessor.event.ts',
            handler: 'handler',
            memorySize: 512,
            timeout: Duration.minutes(5),
            environment: {
                OUTPUT_BUCKET: outputBucket.bucketName,
            } satisfies ProcessorConfig,
        });

        inputBucket.grantRead(this.processorLambda);
        outputBucket.grantWrite(this.processorLambda);

        this.processorLambda.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'polly:SynthesizeSpeech',
                    'polly:DescribeVoices',
                ],
                resources: ['*'],
            })
        );

        this.processorLambda.addEventSource(
            new SqsEventSource(processingQueue, {
                batchSize: 1,
                reportBatchItemFailures: true,
            })
        );

        inputBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(this.receiverLambda),
            {
                prefix: 'input/',
            }
        );
    }
}

