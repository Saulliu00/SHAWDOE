import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import type { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  api: apigateway.RestApi;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(this, 'KindWordsDashboard', {
      dashboardName: 'KindWords-Operations',
    });

    // API Gateway metrics
    const apiRequests = props.api.metricCount({ period: cdk.Duration.minutes(5) });
    const api4xx = props.api.metricClientError({ period: cdk.Duration.minutes(5) });
    const api5xx = props.api.metricServerError({ period: cdk.Duration.minutes(5) });
    const apiLatency = props.api.metricLatency({ period: cdk.Duration.minutes(5) });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Request Count',
        left: [apiRequests],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Errors',
        left: [api4xx, api5xx],
        width: 12,
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Latency',
        left: [apiLatency],
        width: 24,
      }),
    );

    // Alarm: High error rate
    new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      metric: api5xx,
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: 'KindWords API 5xx error rate is high',
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
  }
}
