# Setup Guide for PR Review Agents

Complete step-by-step guide to configure AWS Bedrock and GitHub for automated PR reviews.

## Prerequisites

- AWS account with admin access (or IAM permissions to create roles)
- GitHub organization admin access (to add secrets)
- AWS CLI installed and configured (optional, for verification)

---

## Step 1: Set Up GitHub OIDC Provider in AWS

This allows GitHub Actions to authenticate to AWS without storing long-lived credentials.

### 1.1 Create OIDC Provider (One-time per AWS account)

**Option A: Via AWS Console**

1. Go to **IAM Console** → **Identity providers** → **Add provider**
2. Provider type: **OpenID Connect**
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Click **Add provider**

**Option B: Via AWS CLI**

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 1.2 Verify OIDC Provider

```bash
aws iam list-open-id-connect-providers
```

You should see the provider ARN: `arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com`

---

## Step 2: Create IAM Role for GitHub Actions

### 2.1 Create Trust Policy

Create a file `github-actions-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
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
    }
  ]
}
```

**Important**: Replace `YOUR_ACCOUNT_ID` with your AWS account ID.

The trust policy above allows **any workflow** in **any repo** under the `Tracells` organization to assume this role. If you want tighter security, you can restrict to specific repos:

```json
"StringEquals": {
  "token.actions.githubusercontent.com:sub": [
    "repo:Tracells/tracells-db:*",
    "repo:Tracells/email-processing:*",
    "repo:Tracells/redcap:*"
  ]
}
```

### 2.2 Create Bedrock Permissions Policy

Create a file `bedrock-invoke-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/us.anthropic.claude-sonnet-4-5-v1:0"
      ]
    }
  ]
}
```

If you want to allow other regions or models, add them to the `Resource` array:

```json
"Resource": [
  "arn:aws:bedrock:us-east-1::foundation-model/us.anthropic.claude-sonnet-4-5-v1:0",
  "arn:aws:bedrock:us-west-2::foundation-model/us.anthropic.claude-sonnet-4-5-v1:0"
]
```

### 2.3 Create the IAM Role

**Via AWS CLI:**

```bash
# Create the role with trust policy
aws iam create-role \
  --role-name GitHubActions-BedrockPRReview \
  --assume-role-policy-document file://github-actions-trust-policy.json \
  --description "Role for GitHub Actions to invoke Bedrock for PR reviews"

# Create the permissions policy
aws iam create-policy \
  --policy-name BedrockInvokeModel \
  --policy-document file://bedrock-invoke-policy.json

# Attach the policy to the role
aws iam attach-role-policy \
  --role-name GitHubActions-BedrockPRReview \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/BedrockInvokeModel
```

**Via AWS Console:**

1. Go to **IAM Console** → **Roles** → **Create role**
2. Select **Web identity**
3. Identity provider: Select the OIDC provider you created
4. Audience: `sts.amazonaws.com`
5. Click **Next**
6. Click **Create policy** (opens new tab)
   - Choose **JSON** tab
   - Paste the Bedrock permissions policy
   - Name it `BedrockInvokeModel`
   - Create the policy
7. Back in the role creation, refresh and select `BedrockInvokeModel`
8. Name the role: `GitHubActions-BedrockPRReview`
9. Create the role

### 2.4 Edit Trust Relationship (Console)

After creating the role via console:

1. Click on the role name
2. Go to **Trust relationships** tab
3. Click **Edit trust policy**
4. Replace the entire policy with the trust policy JSON from 2.1
5. Save changes

### 2.5 Get the Role ARN

```bash
aws iam get-role --role-name GitHubActions-BedrockPRReview --query 'Role.Arn' --output text
```

Copy this ARN - you'll need it for GitHub secrets. It looks like:
`arn:aws:iam::123456789012:role/GitHubActions-BedrockPRReview`

---

## Step 3: Enable Bedrock Model Access

Before the role can invoke Claude models, you need to enable model access in AWS Bedrock.

### 3.1 Enable Claude in Bedrock Console

1. Go to **AWS Bedrock Console** → Select region (e.g., `us-east-1`)
2. Click **Model access** in the left sidebar
3. Click **Manage model access** or **Edit**
4. Find **Anthropic** section
5. Check the box for **Claude Sonnet 4.5** (or "Claude 4.x" family)
6. Click **Request model access** or **Save changes**

**Note**: Some models require approval. Claude models are usually instantly available, but check the status.

### 3.2 Verify Model Access

```bash
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query 'modelSummaries[?contains(modelId, `claude`)].{Model:modelId,Status:modelLifecycle.status}' \
  --output table
```

Look for `us.anthropic.claude-sonnet-4-5-v1:0` with status `ACTIVE`.

---

## Step 4: Add GitHub Secrets

You need to add two secrets to each repository (or at organization level for all repos).

### Option A: Organization-Level Secrets (Recommended)

1. Go to **GitHub** → **Your Organization** (Tracells) → **Settings**
2. Click **Secrets and variables** → **Actions**
3. Click **New organization secret**

**Add Secret 1:**
- Name: `AWS_ROLE_ARN`
- Value: `arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-BedrockPRReview`
- Repository access: **Selected repositories** → Select all three repos (tracells-db, email-processing, redcap)

**Add Secret 2:**
- Name: `AWS_REGION`
- Value: `us-east-1` (or your preferred region)
- Repository access: **Selected repositories** → Select all three repos

### Option B: Repository-Level Secrets

For each repository (tracells-db, email-processing, redcap):

1. Go to **Repository** → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**

**Add Secret 1:**
- Name: `AWS_ROLE_ARN`
- Value: `arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-BedrockPRReview`

**Add Secret 2:**
- Name: `AWS_REGION`
- Value: `us-east-1`

---

## Step 5: Test the Setup

### 5.1 Create a Test PR

Pick one repository (e.g., `tracells-db`) and create a test PR:

```bash
cd /Users/danielb/repos/tracells-db

# Create a test branch
git checkout -b test-pr-review-workflow

# Make a small change
echo "# Test PR Review" >> TEST.md
git add TEST.md
git commit -m "Test PR review workflow"

# Push the branch
git push origin test-pr-review-workflow
```

### 5.2 Open Pull Request on GitHub

1. Go to the repository on GitHub
2. You should see a prompt to **Compare & pull request**
3. Click it and create the PR
4. Title: "Test: PR Review Workflow"
5. Create the pull request

### 5.3 Monitor the Workflow

1. In the PR, click **Checks** tab
2. You should see **AI PR Review** workflow running
3. Click on it to see the logs

**Expected behavior:**
- Workflow starts automatically
- Authenticates to AWS via OIDC
- Fetches PR changes
- Runs three reviewer agents (Architecture, Reliability, Security)
- Posts a comment on the PR with findings

### 5.4 Check the Results

Look for a comment from `github-actions[bot]` with format:

```
🤖 AI Senior Review

### Architecture Reviewer
✅ No significant concerns identified.

### Reliability Reviewer
✅ No significant concerns identified.

### Security Reviewer
✅ No significant concerns identified.

---
This is an automated, non-blocking review. Human review is still required.
```

---

## Troubleshooting

### Issue: "Error: Credentials could not be loaded"

**Cause**: OIDC provider not configured or trust policy incorrect

**Fix:**
1. Verify OIDC provider exists: `aws iam list-open-id-connect-providers`
2. Check trust policy has correct organization name: `Tracells`
3. Verify audience is `sts.amazonaws.com`

### Issue: "AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel"

**Cause**: Role doesn't have Bedrock permissions

**Fix:**
1. Verify policy is attached: `aws iam list-attached-role-policies --role-name GitHubActions-BedrockPRReview`
2. Check policy document: `aws iam get-policy-version --policy-arn POLICY_ARN --version-id v1`
3. Verify model access is enabled in Bedrock console

### Issue: "ResourceNotFoundException: Could not find model"

**Cause**: Model not enabled in Bedrock or wrong region

**Fix:**
1. Check model access in Bedrock console for the region
2. Verify region in GitHub secret matches where model is enabled
3. Try `us-east-1` as it usually has the most models

### Issue: Workflow doesn't trigger

**Cause**: Workflow file not merged to main/base branch yet

**Fix:**
1. The workflow needs to exist on the **base branch** (usually `main`)
2. Merge the `t46-add-review-agent-config` branch first
3. Then create test PRs to trigger the workflow

### Issue: "refusing to allow an OAuth App to create or update workflow"

**Cause**: GitHub authentication missing `workflow` scope

**Fix:**
This should be resolved now since you pushed manually. For future reference:
```bash
gh auth refresh -h github.com -s workflow
```

---

## Cost Estimation

### Bedrock Pricing (as of 2024, us-east-1)
- **Claude Sonnet 4.5**:
  - Input: ~$3 per 1M tokens
  - Output: ~$15 per 1M tokens

### Per PR Cost Estimate
- Small PR (5 files, 500 lines): ~10K input + 1K output = **$0.03 - $0.05**
- Medium PR (20 files, 2000 lines): ~40K input + 2K output = **$0.15 - $0.20**
- Large PR (50 files, 5000 lines): ~100K input + 5K output = **$0.40 - $0.50**

Three reviewers run in parallel, but share the same diff context, so cost scales primarily with PR size, not reviewer count.

### Monthly Estimate
- 20 PRs/month, average medium size: **~$3-4/month**
- 100 PRs/month, average medium size: **~$15-20/month**

Much cheaper than a single hour of senior engineer time!

---

## Configuration Options

### Per-Repository Customization

Edit `.github/pr-review.yml` in each repo:

**Disable specific reviewers:**
```yaml
reviewers:
  architecture: false  # Skip architecture review
  reliability: true
  security: true
```

**Increase severity threshold:**
```yaml
min_severity: high  # Only show high-severity findings
```

**Exclude more files:**
```yaml
exclude_patterns:
  - "**/*.test.js"
  - "**/docs/**"
  - "**/examples/**"
  - "**/*.generated.ts"
```

**Increase PR size limit:**
```yaml
max_pr_size: 100  # Review PRs up to 100 files
```

### Global Changes

To modify reviewer behavior, edit the prompt in:
- `src/reviewers/architecture.js`
- `src/reviewers/reliability.js`  
- `src/reviewers/security.js`

Then commit and push to `pr-review-agents` repo.

---

## Next Steps

1. **Merge the config branches** to main in all three repos
2. **Create real test PRs** to validate the workflow
3. **Monitor costs** in AWS Cost Explorer → Filter by "Bedrock"
4. **Tune the config** based on initial results (severity threshold, excluded patterns)
5. **Consider inline comments** as a future enhancement (currently posts summary only)

---

## Support

- **Bedrock Documentation**: https://docs.aws.amazon.com/bedrock/
- **GitHub OIDC Guide**: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
- **Issues**: File in the `pr-review-agents` repository
