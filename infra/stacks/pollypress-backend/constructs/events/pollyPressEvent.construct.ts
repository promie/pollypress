import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
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
    // Max characters sent to Polly per UTC day (Polly bills per character)
    dailyCharacterLimit: number;
};

export class PollyPressEventConstruct extends Construct {
    public readonly receiverLambda: lambda.Function;
    public readonly processorLambda: lambda.Function;
    public readonly processingQueue: sqs.Queue;

    constructor(scope: Construct, id: string, props: PollyPressEventConstructProps) {
        super(scope, id);

        const { appName, stage, inputBucket, outputBucket, dailyCharacterLimit } = props;
        const stackName = `${appName}-${stage}`;

        const deadLetterQueue = new sqs.Queue(this, 'PollyPressEventDLQ', {
            queueName: `${stackName}-PollyPress-Event-DLQ`,
            retentionPeriod: Duration.days(14),
        });

        const processingQueue = new sqs.Queue(this, 'PollyPressEventQueue', {
            queueName: `${stackName}-PollyPress-Event-Queue`,
            // Must exceed the processor's 15 minute timeout
            visibilityTimeout: Duration.minutes(16),
            retentionPeriod: Duration.days(4),
            deadLetterQueue: {
                queue: deadLetterQueue,
                maxReceiveCount: 3,
            },
        });

        this.processingQueue = processingQueue;

        // Tracks characters converted per day to enforce the daily spend cap
        const usageTable = new dynamodb.Table(this, 'UsageTable', {
            tableName: `${stackName}-PollyPress-Usage`,
            partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'expiresAt',
            removalPolicy: RemovalPolicy.DESTROY,
        });

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
            // Extra memory (and CPU) for parsing large PDFs
            memorySize: 2048,
            // Long documents hand off to a new invocation before this is reached
            timeout: Duration.minutes(15),
            environment: {
                OUTPUT_BUCKET: outputBucket.bucketName,
                PROCESSING_QUEUE_URL: processingQueue.queueUrl,
                USAGE_TABLE: usageTable.tableName,
                DAILY_CHARACTER_LIMIT: String(dailyCharacterLimit),
            } satisfies Record<keyof ProcessorConfig, string>,
        });

        inputBucket.grantRead(this.processorLambda);
        // Reads back the extracted text on continuation runs
        outputBucket.grantReadWrite(this.processorLambda);
        // Queues continuation messages for long documents
        processingQueue.grantSendMessages(this.processorLambda);
        usageTable.grantReadWriteData(this.processorLambda);

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

