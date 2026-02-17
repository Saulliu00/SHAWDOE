import { describe, it, expect } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../../lib/stacks/data-stack';

describe('DataStack', () => {
  it('creates three DynamoDB tables', () => {
    const app = new cdk.App();
    const stack = new DataStack(app, 'TestDataStack');
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::DynamoDB::Table', 3);
  });

  it('creates cache table with TTL', () => {
    const app = new cdk.App();
    const stack = new DataStack(app, 'TestDataStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'kindwords-cache',
      KeySchema: [{ AttributeName: 'contentHash', KeyType: 'HASH' }],
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    });
  });

  it('creates stats table with sort key', () => {
    const app = new cdk.App();
    const stack = new DataStack(app, 'TestDataStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'kindwords-stats',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
    });
  });

  it('uses PAY_PER_REQUEST billing', () => {
    const app = new cdk.App();
    const stack = new DataStack(app, 'TestDataStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
    });
  });
});
