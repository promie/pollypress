import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';

export type PollyBudgetConstructProps = {
    appName: string;
    stage: string;
    monthlyLimitUsd: number;
    alertEmail: string;
};

/**
 * Emails when monthly Amazon Polly spend reaches 50%, 80% and 100% of the
 * budget, and when the month is forecast to go over it.
 */
export class PollyBudgetConstruct extends Construct {
    constructor(scope: Construct, id: string, props: PollyBudgetConstructProps) {
        super(scope, id);

        const { appName, stage, monthlyLimitUsd, alertEmail } = props;

        const alert = (threshold: number, notificationType: 'ACTUAL' | 'FORECASTED') => ({
            notification: {
                comparisonOperator: 'GREATER_THAN',
                notificationType,
                threshold,
                thresholdType: 'PERCENTAGE',
            },
            subscribers: [{ subscriptionType: 'EMAIL', address: alertEmail }],
        });

        new budgets.CfnBudget(this, 'Budget', {
            budget: {
                budgetName: `${appName}-${stage}-polly-monthly`,
                budgetType: 'COST',
                timeUnit: 'MONTHLY',
                budgetLimit: { amount: monthlyLimitUsd, unit: 'USD' },
                costFilters: { Service: ['Amazon Polly'] },
            },
            notificationsWithSubscribers: [
                alert(50, 'ACTUAL'),
                alert(80, 'ACTUAL'),
                alert(100, 'ACTUAL'),
                alert(100, 'FORECASTED'),
            ],
        });
    }
}
