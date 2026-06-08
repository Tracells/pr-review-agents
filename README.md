# PR Review Agents

AI-assisted pull request review mechanism that runs multiple specialized senior software engineer agents against GitHub PRs and posts structured feedback.

## Overview

This system provides an additional, non-blocking review layer that helps identify architectural, reliability, maintainability, and security concerns before code is merged.

### Three Review Perspectives

1. **Architecture Reviewer** - System design, module boundaries, API design, maintainability
2. **Reliability Reviewer** - Correctness, edge cases, error handling, observability
3. **Security Reviewer** - Auth/authz, secrets, input validation, data leakage

## Setup

### 1. Add to Your Repository

Create `.github/workflows/pr-review.yml`:

```yaml
name: AI PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  review:
    uses: YOUR-ORG/pr-review-agents/.github/workflows/review.yml@main
    secrets:
      AWS_ROLE_ARN: ${{ secrets.AWS_ROLE_ARN }}
      AWS_REGION: ${{ secrets.AWS_REGION }}
```

### 2. Configure (Optional)

Create `.github/pr-review.yml` to customize behavior:

```yaml
# Enable/disable specific reviewers
reviewers:
  architecture: true
  reliability: true
  security: true

# Minimum severity to report (low, medium, high)
min_severity: medium

# File patterns to exclude
exclude_patterns:
  - "**/*.test.js"
  - "**/*.spec.ts"
  - "**/fixtures/**"

# Maximum PR size (files changed) before skipping review
max_pr_size: 50
```

### 3. Configure AWS Access

This workflow uses AWS Bedrock with OIDC authentication:

1. **Create an IAM role** with Bedrock permissions and trust relationship for GitHub Actions OIDC
2. **Add secrets** to your repository:
   - `AWS_ROLE_ARN` - ARN of the IAM role
   - `AWS_REGION` - AWS region (defaults to us-east-1)

The workflow uses Claude Sonnet 4.5 via Bedrock (`us.anthropic.claude-sonnet-4-5-v1:0`).

## Security

- Reviews are non-blocking by default
- No execution of untrusted PR code
- All PR content treated as untrusted input
- Uses GitHub's native GITHUB_TOKEN for PR comments

## Design Principles

- **Non-blocking**: Assists reviewers, doesn't prevent merges
- **High signal**: Avoids stylistic nitpicks
- **Specialized perspectives**: Each agent has narrow scope
- **Structured output**: Normalized, ranked feedback
