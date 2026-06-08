# Bedrock Migration Summary

This document summarizes the changes made to migrate from Anthropic API to AWS Bedrock.

## Changes Made

### 1. Dependencies (`package.json`)
- **Removed**: `@anthropic-ai/sdk`
- **Added**: `@aws-sdk/client-bedrock-runtime`

### 2. Reviewer Implementation (`src/reviewers/index.js`)
- Replaced Anthropic SDK client with BedrockRuntimeClient
- Updated API call to use `InvokeModelCommand`
- Changed model ID from `claude-sonnet-4-20250514` to `us.anthropic.claude-sonnet-4-5-v1:0`
- Response parsing adjusted for Bedrock format

### 3. Workflow Configuration (`.github/workflows/review.yml`)
- **Removed secret**: `ANTHROPIC_API_KEY`
- **Added secrets**: `AWS_ROLE_ARN`, `AWS_REGION`
- **Added permission**: `id-token: write` (for OIDC)
- **Added step**: `Configure AWS credentials` using OIDC
- Environment variables updated to use AWS region

### 4. Repository Workflow Files
Updated in tracells-db, email-processing, and redcap:
- Changed from passing `ANTHROPIC_API_KEY` to `AWS_ROLE_ARN` and `AWS_REGION`

## Setup Requirements

### AWS IAM Role
Create an IAM role with:

1. **Trust relationship** for GitHub Actions OIDC:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/*:*"
        }
      }
    }
  ]
}
```

2. **Permissions policy** for Bedrock:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/us.anthropic.claude-sonnet-4-5-v1:0"
    }
  ]
}
```

### GitHub Secrets
Add to each repository (or organization level):
- `AWS_ROLE_ARN` - The ARN of the IAM role created above
- `AWS_REGION` - AWS region (defaults to `us-east-1` if not provided)

## Benefits of Bedrock

1. **No API keys** - Uses OIDC authentication (more secure)
2. **Cost optimization** - Bedrock pricing may be more cost-effective
3. **AWS integration** - Better integration with existing AWS infrastructure
4. **Compliance** - May help with compliance requirements for some organizations

## Model Used

- **Bedrock Model ID**: `us.anthropic.claude-sonnet-4-5-v1:0`
- **Region**: us-east-1 (configurable)
- **Equivalent to**: Claude Sonnet 4.5
