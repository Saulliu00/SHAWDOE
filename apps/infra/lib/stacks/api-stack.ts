import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  cacheTable: dynamodb.Table;
  statsTable: dynamodb.Table;
  rateLimitTable: dynamodb.Table;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.api = new apigateway.RestApi(this, 'KindWordsApi', {
      restApiName: 'KindWords API',
      description: 'API for processing and reframing toxic comments',
      defaultCorsPreflightOptions: {
        allowOrigins: ['https://www.youtube.com', 'https://www.twitch.tv'],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'X-Client-Id'],
      },
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
    });

    const handlersPath = path.join(__dirname, '../../../../packages/api-handlers/src/handlers');

    // Process Comments Lambda
    const processCommentsFn = new lambdaNodejs.NodejsFunction(this, 'ProcessCommentsFn', {
      entry: path.join(handlersPath, 'process-comments.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        CACHE_TABLE: props.cacheTable.tableName,
        STATS_TABLE: props.statsTable.tableName,
        RATE_LIMIT_TABLE: props.rateLimitTable.tableName,
        BEDROCK_MODEL_CLASSIFIER: 'us.amazon.nova-2-lite-v1:0',
        BEDROCK_MODEL_REFRAMER: 'us.amazon.nova-2-lite-v1:0',
        BEDROCK_MODEL_SUGGESTER: 'us.amazon.nova-2-lite-v1:0',
        BEDROCK_REGION: 'us-east-1',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    props.cacheTable.grantReadWriteData(processCommentsFn);
    props.statsTable.grantReadWriteData(processCommentsFn);
    props.rateLimitTable.grantReadWriteData(processCommentsFn);
    processCommentsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          'arn:aws:bedrock:us-*::foundation-model/amazon.nova-2-lite-v1:0',
          'arn:aws:bedrock:us-east-1:*:inference-profile/us.amazon.nova-2-lite-v1:0',
        ],
      }),
    );

    // Status Lambda
    const statusFn = new lambdaNodejs.NodejsFunction(this, 'StatusFn', {
      entry: path.join(handlersPath, 'get-status.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        CACHE_TABLE: props.cacheTable.tableName,
      },
    });
    props.cacheTable.grantReadData(statusFn);

    // Stats Lambda
    const statsFn = new lambdaNodejs.NodejsFunction(this, 'StatsFn', {
      entry: path.join(handlersPath, 'get-stats.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        STATS_TABLE: props.statsTable.tableName,
      },
    });
    props.statsTable.grantReadData(statsFn);

    // API routes
    const comments = this.api.root.addResource('comments');
    const process = comments.addResource('process');
    process.addMethod('POST', new apigateway.LambdaIntegration(processCommentsFn));

    this.api.root
      .addResource('status')
      .addMethod('GET', new apigateway.LambdaIntegration(statusFn));

    this.api.root
      .addResource('stats')
      .addMethod('GET', new apigateway.LambdaIntegration(statsFn));

    // Output the API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'KindWords API endpoint',
    });
  }
}
