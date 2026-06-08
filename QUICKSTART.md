# Quick Start Guide

Fast-track setup for PR review agents. See [SETUP.md](SETUP.md) for detailed instructions.

## Prerequisites

- AWS account with admin access
- GitHub organization admin access

## Setup Steps (15 minutes)

### 1. Create OIDC Provider in AWS (one-time)

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. Create IAM Role

**Trust policy** (`trust-policy.json`):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:Tracells/*:*"
      }
    }
  }]
}
```

**Permissions policy** (`bedrock-policy.json`):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock:InvokeModel"],
    "Resource": ["arn:aws:bedrock:us-east-1::foundation-model/us.anthropic.claude-sonnet-4-5-v1:0"]
  }]
}
```

**Create the role:**
```bash
# Replace YOUR_ACCOUNT_ID with your AWS account ID
aws iam create-role \
  --role-name GitHubActions-BedrockPRReview \
  --assume-role-policy-document file://trust-policy.json

aws iam create-policy \
  --policy-name BedrockInvokeModel \
  --policy-document file://bedrock-policy.json

aws iam attach-role-policy \
  --role-name GitHubActions-BedrockPRReview \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/BedrockInvokeModel

# Get the role ARN (copy this!)
aws iam get-role --role-name GitHubActions-BedrockPRReview --query 'Role.Arn' --output text
```

### 3. Enable Bedrock Model Access

1. Go to **AWS Bedrock Console** → us-east-1
2. Click **Model access** → **Manage model access**
3. Enable **Claude Sonnet 4.5**
4. Save

### 4. Add GitHub Secrets

Go to **GitHub** → **Tracells (org)** → **Settings** → **Secrets and variables** → **Actions**

Add two organization secrets:

| Name | Value |
|------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-BedrockPRReview` |
| `AWS_REGION` | `us-east-1` |

Set repository access to: tracells-db, email-processing, redcap

### 5. Merge Config Branches

```bash
# For each repo: tracells-db, email-processing, redcap
cd ~/repos/tracells-db
git checkout main
git merge t46-add-review-agent-config
git push
```

Or create PRs on GitHub to merge the `t46-add-review-agent-config` branches.

### 6. Test

Create a test PR in any repo. The workflow should:
1. ✅ Trigger automatically
2. ✅ Authenticate to AWS
3. ✅ Run three reviewers
4. ✅ Post a comment with findings

## Verification Checklist

- [ ] OIDC provider created in AWS
- [ ] IAM role created with trust policy
- [ ] Bedrock permissions attached to role
- [ ] Claude Sonnet 4.5 enabled in Bedrock (us-east-1)
- [ ] GitHub secrets added (org-level or per-repo)
- [ ] Config branches merged to main
- [ ] Test PR created and workflow runs successfully

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Credentials could not be loaded" | Check trust policy has correct org name (`Tracells`) |
| "AccessDeniedException: bedrock:InvokeModel" | Attach Bedrock policy to IAM role |
| "ResourceNotFoundException: Could not find model" | Enable Claude in Bedrock console for us-east-1 |
| Workflow doesn't trigger | Merge workflow files to main branch first |

## Cost

- Small PR: ~$0.03-0.05
- Medium PR: ~$0.15-0.20
- Large PR: ~$0.40-0.50

Estimated ~$3-4/month for 20 PRs.

## Customization

Edit `.github/pr-review.yml` in each repo:

```yaml
# Disable a reviewer
reviewers:
  security: false

# Only show high-severity findings
min_severity: high

# Increase PR size limit
max_pr_size: 100
```

## Full Documentation

See [SETUP.md](SETUP.md) for complete step-by-step guide with screenshots and detailed troubleshooting.
