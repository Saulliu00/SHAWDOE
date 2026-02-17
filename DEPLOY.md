# KindWords — Deployment Guide

Deploy the KindWords backend to AWS and load the Chrome extension. This guide assumes you have an AWS account with CLI credentials already configured.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | `nvm install 20` or https://nodejs.org |
| AWS CLI | v2 | https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html |
| AWS CDK | 2.x | `npm install -g aws-cdk` |
| Chrome | Latest | https://www.google.com/chrome |

Verify your AWS credentials are working:

```bash
aws sts get-caller-identity
```

You should see your account ID and IAM user ARN. Note your **12-digit account number**.

---

## Step 1: Install & Build

```bash
git clone https://github.com/Saulliu00/SHAWDOE.git kindwords
cd kindwords
npm install
npm run build
```

Run tests to verify everything compiles:

```bash
npm run test
```

Expected: **30 tests passing** across 4 suites.

---

## Step 2: Bootstrap CDK (First Time Only)

CDK needs a one-time bootstrap per account/region:

```bash
cd apps/infra

# Replace 123456789012 with YOUR account number
npx cdk bootstrap aws://123456789012/us-east-1
```

Wait for: `Environment aws://123456789012/us-east-1 bootstrapped.`

---

## Step 3: Deploy to AWS

Preview what will be created:

```bash
npx cdk diff
```

Deploy all 3 stacks:

```bash
npx cdk deploy --all --require-approval broadening
```

Type `y` when prompted to approve IAM changes. Deployment takes 2-5 minutes.

When complete, you'll see:

```
Outputs:
KindWords-Api.ApiUrl = https://<random-id>.execute-api.us-east-1.amazonaws.com/v1/
```

**Save this API URL** — you need it for the extension.

### What Gets Created

| Stack | Resources |
|-------|-----------|
| **KindWords-Data** | 3 DynamoDB tables (cache, stats, rate-limits) |
| **KindWords-Api** | 3 Lambda functions + API Gateway REST API |
| **KindWords-Monitoring** | CloudWatch dashboard + 5xx error alarm |

---

## Step 4: Verify the API

Health check:

```bash
curl https://<YOUR_API_URL>/status
```

Expected: `{"status":"healthy","version":"1.0.0",...}`

Test comment processing:

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

The toxic comment (`test-1`) should come back with `isToxic: true`, a reframed version, and a suggested response. The clean comment (`test-2`) should have `isToxic: false`.

---

## Step 5: Configure & Load the Extension

### 5.1 Set the API URL

Edit [apps/extension/src/shared/constants.ts](apps/extension/src/shared/constants.ts) — change `apiBaseUrl` to your deployed API URL:

```typescript
apiBaseUrl: 'https://<random-id>.execute-api.us-east-1.amazonaws.com/v1',
```

### 5.2 Rebuild the Extension

```bash
# From the project root
npm run build -w @kindwords/extension
```

### 5.3 Load in Chrome

1. Open `chrome://extensions/`
2. Toggle **Developer mode** ON (top-right)
3. Click **Load unpacked**
4. Select the `apps/extension/dist/` folder
5. Pin the extension to your toolbar (puzzle piece icon -> pin)

### 5.4 Test It

1. Open a YouTube video with comments
2. Scroll to the comments section
3. Wait 2-3 seconds — toxic comments get:
   - Replaced with reframed text
   - Marked with a purple left border and **KW** badge
4. Click the badge to see the original text, toxicity level, and suggested reply

Works on **Twitch** live chat too.

---

## Redeploying After Code Changes

After editing any backend code:

```bash
# From project root
npm run build

# From apps/infra
cd apps/infra
npx cdk deploy --all --require-approval broadening
```

After editing extension code:

```bash
npm run build -w @kindwords/extension
```

Then reload the extension in `chrome://extensions/` (click the refresh icon).

---

## Monitoring

### CloudWatch Dashboard

Go to [CloudWatch > Dashboards > KindWords-Operations](https://console.aws.amazon.com/cloudwatch/) to see:
- API request counts
- 4xx/5xx error rates
- Response latency

### Lambda Logs

Go to CloudWatch > Log groups and look for `/aws/lambda/KindWords-Api-*` log groups. Logs are structured JSON.

### Error Alarm

A CloudWatch alarm triggers when 5xx errors exceed 5 in two consecutive 5-minute periods. Add email notifications via CloudWatch > Alarms > HighErrorRateAlarm > Edit > Add notification.

---

## Configuration

### Batch Size & Timeout

If the Lambda times out on large batches, adjust in [api-stack.ts](apps/infra/lib/stacks/api-stack.ts):

```typescript
timeout: cdk.Duration.seconds(60),  // increase from 30s
```

Or reduce the extension's batch size in [constants.ts](apps/extension/src/shared/constants.ts):

```typescript
batchSize: 10,  // reduce from 25
```

### Rate Limits

| Layer | File | Default |
|-------|------|---------|
| Extension (client-side) | `apps/extension/src/service-worker/rate-limiter.ts` | 30 req/min |
| Lambda (server-side) | `packages/data-access/src/repositories/rate-limit.repository.ts` | 60 req/min |
| API Gateway | `apps/infra/lib/stacks/api-stack.ts` | 100 req/sec sustained, 200 burst |

### Switching LLM Models

Change model IDs in [api-stack.ts](apps/infra/lib/stacks/api-stack.ts):

```typescript
BEDROCK_MODEL_CLASSIFIER: 'us.amazon.nova-2-lite-v1:0',
BEDROCK_MODEL_REFRAMER: 'us.amazon.nova-2-lite-v1:0',
BEDROCK_MODEL_SUGGESTER: 'us.amazon.nova-2-lite-v1:0',
```

> Non-Amazon models (e.g., Anthropic Claude) require changes to the request/response format in `packages/llm-pipeline/src/bedrock-client.ts` and the IAM policy.

---

## Tearing Down

Remove all AWS resources:

```bash
cd apps/infra
npx cdk destroy --all
```

This permanently deletes all Lambda functions, DynamoDB tables (and their data), API Gateway, and CloudWatch resources.

---

## Known Limitations

| Issue | Impact | Workaround |
|-------|--------|------------|
| No API authentication | Anyone with the URL can call the API | Add API Gateway API keys or WAF |
| CORS allows all origins at preflight | Preflight succeeds for any origin (actual requests are filtered) | Restrict `allowOrigins` in api-stack.ts |
| Rate limit uses client-generated UUID | Trivially bypassed by rotating IDs | Add IP-based rate limiting via WAF |
| Lambda timeout (30s) | Large toxic batches may timeout | Increase timeout or reduce batch size |
| Stats show today only | `getStats()` returns daily counts, not all-time | Scan all DAILY# partitions for totals |
| `sensitivityThreshold` unused | Popup setting has no effect on backend | Wire the value into the API request |
| Non-ASCII text stripped in normalizer | International comments hash to the same cache key | Update regex in text-normalizer.ts |
| `RemovalPolicy.DESTROY` on all tables | `cdk destroy` permanently deletes all data | Change to `RETAIN` for production |

---

## Cost Estimate

| Volume | Bedrock Cost | Other AWS | Total |
|--------|-------------|-----------|-------|
| 1,000 comments/day | ~$0.36/mo | Free tier | ~$0.36/mo |
| 10,000 comments/day | ~$3.60/mo | Free tier | ~$3.60/mo |
| 100,000 comments/day | ~$36/mo | ~$5/mo | ~$41/mo |

Caching significantly reduces repeat costs. All non-Bedrock services fall under AWS free tier at low-to-moderate volume.
