# KindWords — Quick Start Guide

A step-by-step guide to deploy KindWords on AWS and load the Chrome extension. Includes detailed AWS console instructions for every service.

---

## Table of Contents

1. [Prerequisites — Local Tools](#1-prerequisites--local-tools)
2. [AWS Account Setup](#2-aws-account-setup)
3. [Configure AWS CLI Credentials](#3-configure-aws-cli-credentials)
4. [Enable Amazon Bedrock Model Access](#4-enable-amazon-bedrock-model-access)
5. [Install and Build the Project](#5-install-and-build-the-project)
6. [Deploy Infrastructure with CDK](#6-deploy-infrastructure-with-cdk)
7. [Verify AWS Resources in the Console](#7-verify-aws-resources-in-the-console)
8. [Test the API](#8-test-the-api)
9. [Configure and Load the Chrome Extension](#9-configure-and-load-the-chrome-extension)
10. [Test End-to-End](#10-test-end-to-end)
11. [Monitoring and Logs](#11-monitoring-and-logs)
12. [Customizing the Deployment](#12-customizing-the-deployment)
13. [Cost Estimate](#13-cost-estimate)
14. [Tearing Down](#14-tearing-down)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Prerequisites — Local Tools

Install these before starting:

### Node.js 20+

```bash
# Check your version
node --version    # Should be v20.x or higher

# Install via https://nodejs.org or nvm:
nvm install 20
nvm use 20
```

### AWS CLI v2

```bash
# Check your version
aws --version    # Should be aws-cli/2.x.x

# Install:
# Windows: https://awscli.amazonaws.com/AWSCLIV2.msi
# macOS:   brew install awscli
# Linux:   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
```

### AWS CDK CLI

```bash
npm install -g aws-cdk

# Verify
cdk --version    # Should be 2.x.x
```

### Google Chrome

Download from https://www.google.com/chrome/ (the extension requires Manifest V3 support).

---

## 2. AWS Account Setup

If you don't have an AWS account yet:

1. Go to https://aws.amazon.com/ and click **Create an AWS Account**
2. Enter your email, choose an account name
3. Add payment information (required, but free tier covers most costs)
4. Complete identity verification
5. Select the **Basic (Free)** support plan

### Choose Your Region

KindWords uses **Amazon Bedrock** which is only available in certain regions. We recommend **US East (N. Virginia) / `us-east-1`** because it has the broadest Bedrock model availability.

To set your default region:

1. Log in to the [AWS Management Console](https://console.aws.amazon.com/)
2. In the top-right corner, click the **region dropdown** (next to your account name)
3. Select **US East (N. Virginia)** — this sets `us-east-1`

> All instructions below assume `us-east-1`. If you pick a different region, replace it in every command.

### Create an IAM User for Deployment

Do **not** deploy with your root account. Create a dedicated IAM user:

1. Go to **IAM Console**: https://console.aws.amazon.com/iam/
2. In the left sidebar, click **Users** → **Create user**
3. User name: `kindwords-deployer`
4. Click **Next**
5. Select **Attach policies directly**
6. Search for and check these policies:
   - `AdministratorAccess` (for initial setup; you can scope this down later)
7. Click **Next** → **Create user**
8. Click the user name `kindwords-deployer` → **Security credentials** tab
9. Under **Access keys**, click **Create access key**
10. Select **Command Line Interface (CLI)**
11. Check the acknowledgment box → **Next** → **Create access key**
12. **Save both keys** — you'll need them in the next step:
    - Access key ID: `AKIAIOSFODNN7EXAMPLE`
    - Secret access key: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

---

## 3. Configure AWS CLI Credentials

Run this command and enter the keys from Step 2:

```bash
aws configure
```

It will prompt you for 4 values:

```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

Verify it works:

```bash
aws sts get-caller-identity
```

Expected output:

```json
{
    "UserId": "AIDA...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/kindwords-deployer"
}
```

Note your 12-digit **Account** number — you'll need it for CDK bootstrap.

---

## 4. Enable Amazon Bedrock Model Access

KindWords uses **Amazon Nova 2 Lite** via Amazon Bedrock. You must explicitly enable model access before the Lambda functions can call it.

### Navigate to Bedrock Console

1. Go to https://console.aws.amazon.com/bedrock/
2. **Check your region** — in the top-right corner of the page (next to your account name), you'll see a region name. Click the dropdown and select **US East (N. Virginia)** if it's not already selected. This sets `us-east-1`.
3. If this is your first time visiting Bedrock, you'll see a welcome/landing page — click **Get started** to enter the console.

### Request Model Access

1. In the **left sidebar**, look for the section called **Bedrock configurations** (you may need to scroll down).
2. Click **Model access** under that section.
3. You'll see "Model access page has been retired
Serverless foundation models are now automatically enabled across all AWS commercial regions when first invoked in your account, so you can start using them instantly. You no longer need to manually activate model access through this page. Note that for Anthropic models, first-time users may need to submit use case details before they can access the model. For models served from AWS Marketplace, a user with AWS Marketplace permissions  must invoke the model once to enable it account-wide for all users."

Run this command in your terminal to confirm the model is available:

```bash
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query "modelSummaries[?modelId=='amazon.nova-2-lite-v1:0'].{id:modelId,status:modelLifecycle.status}" \
  --output table
```

Expected output:

```
-----------------------------------------
|       ListFoundationModels            |
+---------------------------+-----------+
|            id             |  status   |
+---------------------------+-----------+
|  amazon.nova-2-lite-v1:0  |  ACTIVE  |
+---------------------------+-----------+
```

If the table is empty, model access hasn't been granted yet — go back to the Bedrock console and repeat the steps above.

---

## 5. Install and Build the Project

### Clone and Install

```bash
git clone <your-repo-url> kindwords
cd kindwords
npm install
```

### Build All Packages

Turborepo builds packages in dependency order automatically:

```bash
npm run build
```

This compiles:
- `@kindwords/types` → shared TypeScript interfaces
- `@kindwords/utils` → utility functions
- `@kindwords/llm-pipeline` → LLM agent stages
- `@kindwords/data-access` → DynamoDB repositories
- `@kindwords/api-handlers` → Lambda handlers
- `@kindwords/infra` → CDK stacks
- `@kindwords/extension` → Chrome extension bundle

### Run Tests

```bash
npm run test
```

Expected: **30 tests passing** across 4 test suites (utils: 13, llm-pipeline: 7, api-handlers: 6, infra: 4).

---

## 6. Deploy Infrastructure with CDK

### 6.1 Bootstrap CDK (First Time Only)

CDK needs a one-time bootstrap to create an S3 bucket and IAM roles in your account:

```bash
cd apps/infra

# Replace 123456789012 with YOUR account number from Step 3
npx cdk bootstrap aws://123456789012/us-east-1
```

You'll see output ending with:

```
 ✅  Environment aws://123456789012/us-east-1 bootstrapped.
```

### 6.2 Preview What Will Be Created

Before deploying, see exactly what resources CDK will provision:

```bash
npx cdk diff
```

This outputs a diff for 3 CloudFormation stacks:

**Stack: KindWords-Data** — Database layer
```
[+] AWS::DynamoDB::Table  kindwords-cache        (pay-per-request, TTL enabled)
[+] AWS::DynamoDB::Table  kindwords-stats         (pay-per-request)
[+] AWS::DynamoDB::Table  kindwords-rate-limits   (pay-per-request, TTL enabled)
```

**Stack: KindWords-Api** — Compute + API layer
```
[+] AWS::ApiGateway::RestApi      KindWords API
[+] AWS::Lambda::Function         ProcessCommentsFn   (Node.js 20, 512MB, 30s)
[+] AWS::Lambda::Function         StatusFn            (Node.js 20, 128MB, 5s)
[+] AWS::Lambda::Function         StatsFn             (Node.js 20, 128MB, 5s)
[+] AWS::IAM::Policy              Bedrock InvokeModel permission
[+] AWS::IAM::Policy              DynamoDB read/write permissions
```

**Stack: KindWords-Monitoring** — Observability
```
[+] AWS::CloudWatch::Dashboard    KindWords-Operations
[+] AWS::CloudWatch::Alarm        5xx error rate alarm
```

### 6.3 Deploy All Stacks

```bash
npx cdk deploy --all --require-approval broadening
```

CDK deploys stacks in dependency order: Data → Api → Monitoring.

**You will be prompted to approve IAM/security changes:**

```
Do you wish to deploy these changes (y/n)? y
```

Type `y` and press Enter for each stack.

Deployment takes **2-5 minutes**. When complete, look for:

```
✅  KindWords-Data
✅  KindWords-Api

Outputs:
KindWords-Api.ApiUrl = https://abc123xyz.execute-api.us-east-1.amazonaws.com/v1/

✅  KindWords-Monitoring
```

**Copy the `ApiUrl` value** — you'll need it in Step 9.

---

## 7. Verify AWS Resources in the Console

After deployment, verify that everything was created correctly.

### 7.1 Check DynamoDB Tables

1. Go to **DynamoDB Console**: https://console.aws.amazon.com/dynamodbv2/
2. Click **Tables** in the left sidebar
3. You should see 3 tables:

| Table Name | Partition Key | Sort Key | TTL |
|------------|--------------|----------|-----|
| `kindwords-cache` | `contentHash` (String) | — | `ttl` (enabled) |
| `kindwords-stats` | `pk` (String) | `sk` (String) | — |
| `kindwords-rate-limits` | `clientId` (String) | — | `ttl` (enabled) |

4. Click any table → **Additional settings** tab → verify **Billing mode** is **On-demand**

### 7.2 Check Lambda Functions

1. Go to **Lambda Console**: https://console.aws.amazon.com/lambda/
2. You should see 3 functions (names prefixed with `KindWords-Api-`):

| Function | Memory | Timeout | Runtime |
|----------|--------|---------|---------|
| `...ProcessCommentsFn...` | 512 MB | 30 sec | Node.js 20.x |
| `...StatusFn...` | 128 MB | 5 sec | Node.js 20.x |
| `...StatsFn...` | 128 MB | 5 sec | Node.js 20.x |

3. Click the `ProcessCommentsFn` → **Configuration** tab → **Environment variables**
4. Verify these are set:

| Key | Value |
|-----|-------|
| `CACHE_TABLE` | `kindwords-cache` |
| `STATS_TABLE` | `kindwords-stats` |
| `RATE_LIMIT_TABLE` | `kindwords-rate-limits` |
| `BEDROCK_REGION` | `us-east-1` |
| `BEDROCK_MODEL_CLASSIFIER` | `amazon.nova-2-lite-v1:0` |
| `BEDROCK_MODEL_REFRAMER` | `amazon.nova-2-lite-v1:0` |
| `BEDROCK_MODEL_SUGGESTER` | `amazon.nova-2-lite-v1:0` |

### 7.3 Check API Gateway

1. Go to **API Gateway Console**: https://console.aws.amazon.com/apigateway/
2. Click **KindWords API**
3. In the left sidebar, click **Resources** — you should see:

```
/
├── /comments
│   └── /process      POST
├── /stats             GET
└── /status            GET
```

4. Click **Stages** in the left sidebar → you should see a **v1** stage
5. The **Invoke URL** at the top is your API endpoint

### 7.4 Check CloudWatch Dashboard

1. Go to **CloudWatch Console**: https://console.aws.amazon.com/cloudwatch/
2. Click **Dashboards** in the left sidebar
3. Click **KindWords-Operations**
4. You'll see widgets for API request count, errors, and latency (all zero initially)

---

## 8. Test the API

### Health Check

```bash
curl https://<YOUR_API_URL>/status
```

Replace `<YOUR_API_URL>` with the URL from Step 6.3 (e.g. `https://abc123xyz.execute-api.us-east-1.amazonaws.com/v1`).

Expected response:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-02-16T12:00:00.000Z",
  "services": {
    "dynamodb": "up",
    "bedrock": "up"
  }
}
```

### Process a Test Batch

```bash
curl -X POST https://<YOUR_API_URL>/comments/process \
  -H "Content-Type: application/json" \
  -d '{
    "comments": [
      { "id": "test-1", "text": "you are so dumb, this video is garbage" },
      { "id": "test-2", "text": "great tutorial, thanks for sharing!" }
    ],
    "platform": "youtube",
    "clientId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

Expected response (abbreviated):

```json
{
  "results": [
    {
      "id": "test-1",
      "original": "you are so dumb, this video is garbage",
      "toxicity": {
        "isToxic": true,
        "level": "moderate",
        "confidence": 0.92,
        "categories": ["insult", "dismissive"]
      },
      "reframed": "I'm really frustrated with this video, I feel like it could be done a lot better",
      "suggestedResponse": "I hear you, sometimes content doesn't hit the mark. What would you have liked to see instead?",
      "fromCache": false
    },
    {
      "id": "test-2",
      "original": "great tutorial, thanks for sharing!",
      "toxicity": {
        "isToxic": false,
        "level": "none",
        "confidence": 0.98,
        "categories": ["none"]
      },
      "reframed": null,
      "suggestedResponse": null,
      "fromCache": false
    }
  ],
  "metadata": {
    "processedAt": "2026-02-16T12:00:01.234Z",
    "cachedCount": 0,
    "processedCount": 2,
    "batchId": "..."
  }
}
```

Run the same curl command again — the second time, both results should have `"fromCache": true` (served from DynamoDB, no LLM call).

### Verify Cache in DynamoDB

1. Go to **DynamoDB Console** → **Tables** → **kindwords-cache**
2. Click **Explore table items**
3. You should see 2 items (one per test comment) with their toxicity classifications and reframed text

---

## 9. Configure and Load the Chrome Extension

### 9.1 Update the API URL

Open `apps/extension/src/shared/constants.ts` and change the `apiBaseUrl`:

**Before:**
```typescript
apiBaseUrl: 'https://api.kindwords.app/v1',
```

**After:**
```typescript
apiBaseUrl: 'https://abc123xyz.execute-api.us-east-1.amazonaws.com/v1',
```

Use the exact URL from your CDK deploy output (Step 6.3).

### 9.2 (Optional) Add Extension Icons

Replace the placeholder icon files in `apps/extension/assets/icons/` with real PNG images:

| File | Size |
|------|------|
| `icon-16.png` | 16 x 16 pixels |
| `icon-48.png` | 48 x 48 pixels |
| `icon-128.png` | 128 x 128 pixels |

### 9.3 Build the Extension

```bash
# From the project root
npm run build -w @kindwords/extension
```

This creates a ready-to-load extension in `apps/extension/dist/`.

### 9.4 Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. In the top-right corner, toggle **Developer mode** ON
3. Click **Load unpacked** (top-left)
4. In the file picker, navigate to your project and select the `apps/extension/dist/` folder
5. Click **Select Folder**
6. The KindWords extension now appears in your extensions list
7. Pin it to your toolbar: click the puzzle piece icon in Chrome's toolbar → click the pin icon next to KindWords

---

## 10. Test End-to-End

### YouTube

1. Open any YouTube video with a comment section (e.g. a popular music video)
2. Scroll down to the comments
3. Wait 2-3 seconds for the extension to process the visible comments
4. Toxic comments will be:
   - Replaced with warmer reframed text
   - Marked with a **purple left border**
   - Annotated with a **KW** badge (purple circle)
5. Click the **KW** badge on any reframed comment to see:
   - The original toxic text (red, struck through)
   - Toxicity level and confidence percentage
   - A suggested kind reply

### Twitch

1. Open any live Twitch stream with active chat (e.g. a popular streamer)
2. Watch the chat — toxic messages are reframed in real-time
3. Twitch flushes batches every 1 second (vs 2 seconds on YouTube) since chat moves faster

### Extension Popup

Click the KindWords extension icon in your toolbar to see:

- **Enable/Disable toggle** — turn the extension on or off globally
- **Platform toggles** — enable/disable for YouTube and Twitch independently
- **Sensitivity selector** — choose minimum toxicity level to trigger reframing:
  - "All toxic (mild+)" — reframes everything mildly rude or worse
  - "Moderate+" — only reframes clearly hostile comments
  - "Severe only" — only reframes extreme hate speech and threats
- **Stats** — how many comments you've reframed today and in total

---

## 11. Monitoring and Logs

### CloudWatch Dashboard

1. Go to **CloudWatch Console**: https://console.aws.amazon.com/cloudwatch/
2. Click **Dashboards** → **KindWords-Operations**
3. Widgets show:
   - **API Request Count** — total requests per 5-minute window
   - **API Errors** — 4xx (client errors) and 5xx (server errors)
   - **API Latency** — response time in milliseconds

### Lambda Logs

1. Go to **CloudWatch Console** → **Log groups** in the left sidebar
2. You'll see log groups for each Lambda function:
   - `/aws/lambda/KindWords-Api-ProcessCommentsFn...`
   - `/aws/lambda/KindWords-Api-StatusFn...`
   - `/aws/lambda/KindWords-Api-StatsFn...`
3. Click a log group → click the latest **Log stream**
4. Logs are structured JSON:

```json
{"timestamp":"...","level":"info","context":"ProcessComments","message":"Processing comments","requestId":"...","count":5,"platform":"youtube"}
{"timestamp":"...","level":"info","context":"KindWordsPipeline","message":"Classification complete","total":5,"toxic":1,"clean":4}
```

### Alarms

An alarm is configured to trigger when 5xx errors exceed 5 in two consecutive 5-minute periods. To add notification (e.g. email):

1. Go to **CloudWatch Console** → **Alarms** → **All alarms**
2. Click the **HighErrorRateAlarm**
3. Click **Edit** → under **Notification**, click **Add notification**
4. Select **Create new topic** → enter your email → **Create topic**
5. Check your email and confirm the SNS subscription

---

## 12. Customizing the Deployment

### Change the AWS Region

Edit `apps/infra/bin/app.ts`:

```typescript
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'eu-west-1',  // Change from us-east-1 to your preferred region
};
```

Also update the Bedrock region in `apps/infra/lib/stacks/api-stack.ts`:

```typescript
BEDROCK_REGION: 'eu-west-1',
```

> Make sure Bedrock + Amazon Nova 2 Lite is available in your chosen region.

### Use a Different LLM Model

To upgrade the reframing quality (at higher cost), change the model in the CDK environment variables:

```typescript
// apps/infra/lib/stacks/api-stack.ts
const commonEnv = {
  // ...
  BEDROCK_MODEL_REFRAMER: 'amazon.nova-pro-v1:0',  // Better quality
  // ...
};
```

Available Amazon Nova models (must be enabled in Bedrock model access):

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `amazon.nova-2-lite-v1:0` | Fast | Good | Lowest |
| `amazon.nova-pro-v1:0` | Medium | Better | Medium |
| `amazon.nova-premier-v1:0` | Slower | Best | Higher |

> **Note:** If you switch to a non-Amazon model (e.g. Anthropic Claude), you'll also need to update the Bedrock client request/response format in `packages/llm-pipeline/src/bedrock-client.ts` and the IAM policy in `apps/infra/lib/stacks/api-stack.ts`.

### Change Lambda Memory or Timeout

Edit `apps/infra/lib/stacks/api-stack.ts`:

```typescript
const processCommentsFn = new lambdaNodejs.NodejsFunction(this, 'ProcessCommentsFn', {
  // ...
  memorySize: 1024,                        // Increase from 512 MB
  timeout: cdk.Duration.seconds(60),       // Increase from 30s
});
```

### Change Rate Limits

Client-side limit (extension): edit `apps/extension/src/service-worker/rate-limiter.ts`:

```typescript
const MAX_REQUESTS_PER_MINUTE = 30;  // Change this value
```

Server-side limit (Lambda): edit the constructor call in the handler or change the default in `packages/data-access/src/repositories/rate-limit.repository.ts`:

```typescript
constructor(
  private tableName: string,
  private maxRequestsPerWindow: number = 60,  // Change this value
)
```

API Gateway throttle: edit `apps/infra/lib/stacks/api-stack.ts`:

```typescript
deployOptions: {
  stageName: 'v1',
  throttlingRateLimit: 100,   // Sustained requests per second
  throttlingBurstLimit: 200,  // Burst limit
},
```

After any change, redeploy:

```bash
cd apps/infra
npx cdk deploy --all
```

---

## 13. Cost Estimate

All AWS services used are pay-per-request with generous free tiers:

| Service | Free Tier (monthly) | Price Beyond Free Tier |
|---------|--------------------|-----------------------|
| **Lambda** | 1M requests + 400,000 GB-seconds | $0.20 per 1M requests |
| **DynamoDB** | 25 GB storage + 25 WCU/RCU | $1.25 per 1M write requests |
| **API Gateway** | 1M REST API calls for 12 months | $3.50 per 1M requests |
| **Bedrock (Nova 2 Lite)** | No free tier | ~$0.06 / 1M input tokens, ~$0.24 / 1M output tokens |
| **CloudWatch** | 10 custom metrics, 3 dashboards | Minimal at low volume |

### Example: 10,000 comments processed per day

| Component | Monthly Usage | Estimated Cost |
|-----------|-------------|---------------|
| API Gateway | ~300K requests | Free tier |
| Lambda | ~300K invocations | Free tier |
| DynamoDB | ~300K writes, ~600K reads | Free tier |
| Bedrock (classification) | ~10M tokens | ~$0.60 input + $2.40 output |
| Bedrock (reframing, ~20% toxic) | ~2M tokens | ~$0.12 input + $0.48 output |
| **Total** | | **~$3.60/month** |

> Costs scale linearly. 100,000 comments/day would be ~$36/month. Caching reduces repeat costs significantly.

---

## 14. Tearing Down

To remove all AWS resources and stop all costs:

```bash
cd apps/infra
npx cdk destroy --all
```

You will be prompted to confirm each stack:

```
Are you sure you want to delete: KindWords-Monitoring, KindWords-Api, KindWords-Data (y/n)? y
```

This deletes:
- All 3 Lambda functions
- API Gateway and custom domain (if any)
- All 3 DynamoDB tables **and their data**
- CloudWatch dashboard and alarms
- All IAM roles created by CDK

> DynamoDB tables have `RemovalPolicy.DESTROY`, so all cached data is permanently deleted.

To also clean up the CDK bootstrap resources (optional):

```bash
aws cloudformation delete-stack --stack-name CDKToolkit --region us-east-1
```

---

## 15. Troubleshooting

### "AccessDeniedException" when calling Bedrock InvokeModel

**Cause:** Amazon Nova 2 Lite is not enabled in your Bedrock model access.

**Fix:** Go to [Bedrock Console](https://console.aws.amazon.com/bedrock/) → **Model access** → enable **Amazon → Nova 2 Lite**. See [Step 4](#4-enable-amazon-bedrock-model-access).

### "User: arn:aws:iam::... is not authorized to perform: bedrock:InvokeModel"

**Cause:** The Lambda execution role doesn't have Bedrock permissions.

**Fix:** This should be auto-configured by CDK. If not, check the Lambda's execution role in IAM → it should have a policy allowing `bedrock:InvokeModel` on `arn:aws:bedrock:*::foundation-model/amazon.nova*`.

### CDK deploy fails with "Unable to resolve AWS account"

**Cause:** AWS CLI credentials are not configured.

**Fix:** Run `aws configure` and enter your access key, secret key, and region. See [Step 3](#3-configure-aws-cli-credentials).

### CDK deploy fails with "CDKToolkit stack is missing"

**Cause:** CDK hasn't been bootstrapped in this account/region.

**Fix:** Run `npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1`. See [Step 6.1](#61-bootstrap-cdk-first-time-only).

### Extension shows red status dot in popup

**Cause:** The extension can't reach the API.

**Fix:**
1. Verify the API is deployed: `curl https://<YOUR_API_URL>/status`
2. Check that `apiBaseUrl` in `apps/extension/src/shared/constants.ts` matches your API URL exactly
3. Rebuild the extension after changing the URL: `npm run build -w @kindwords/extension`
4. Reload the extension in `chrome://extensions/` (click the refresh icon)

### Comments are not being reframed on YouTube

**Fix:**
1. Click the KindWords icon — verify it's **enabled** and **YouTube** toggle is on
2. Open Chrome DevTools (F12) → Console tab → look for `[KindWords]` messages
3. Open Network tab → filter by your API domain → check for failed requests
4. If you see 429 errors, you're being rate-limited — wait 1 minute

### Lambda times out (30 seconds)

**Cause:** Large batches of highly toxic comments require 3 sequential Bedrock calls.

**Fix options:**
1. Reduce batch size: in `apps/extension/src/shared/constants.ts`, change `batchSize: 25` to `batchSize: 10`
2. Increase Lambda timeout: in `apps/infra/lib/stacks/api-stack.ts`, change `timeout: cdk.Duration.seconds(30)` to `seconds(60)`
3. Rebuild and redeploy after changes

### "RATE_LIMITED" error in console

**Cause:** More than 60 requests per minute from the same clientId.

**Fix:** This is expected during heavy browsing. The extension will automatically retry. If you need higher limits, change `maxRequestsPerWindow` in `packages/data-access/src/repositories/rate-limit.repository.ts` and redeploy.
