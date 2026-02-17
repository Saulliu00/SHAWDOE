import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';

export class DataStack extends cdk.Stack {
  public readonly cacheTable: dynamodb.Table;
  public readonly statsTable: dynamodb.Table;
  public readonly rateLimitTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.cacheTable = new dynamodb.Table(this, 'CacheTable', {
      tableName: 'kindwords-cache',
      partitionKey: { name: 'contentHash', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.statsTable = new dynamodb.Table(this, 'StatsTable', {
      tableName: 'kindwords-stats',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
      tableName: 'kindwords-rate-limits',
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
