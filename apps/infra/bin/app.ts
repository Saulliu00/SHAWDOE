#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/stacks/data-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const dataStack = new DataStack(app, 'KindWords-Data', { env });

const apiStack = new ApiStack(app, 'KindWords-Api', {
  env,
  cacheTable: dataStack.cacheTable,
  statsTable: dataStack.statsTable,
  rateLimitTable: dataStack.rateLimitTable,
});
apiStack.addDependency(dataStack);

const monitoringStack = new MonitoringStack(app, 'KindWords-Monitoring', {
  env,
  api: apiStack.api,
});
monitoringStack.addDependency(apiStack);

app.synth();
