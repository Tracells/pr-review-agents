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

permissions:
  contents: read
  pull-requests: write
  id-token: write

jobs:
  review:
    # Skip draft PRs and forks to avoid unnecessary costs
    if: github.event.pull_request.head.repo.full_name == github.repository && !github.event.pull_request.draft
    uses: Tracells/pr-review-agents/.github/workflows/review.yml@main
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

The workflow uses Claude Sonnet 4.5 via Bedrock (`us.anthropic.claude-sonnet-4-5-20250929-v1:0`).

See [SETUP.md](SETUP.md) for detailed setup instructions.

## Development

### Testing Changes

This repo has automated tests that run on every PR:
- **Syntax validation** - JavaScript and YAML syntax checks
- **Structure validation** - Required files and module structure
- **Breaking change detection** - Warns about changes that might break calling repos
- **Integration tests** - Smoke tests to ensure modules load correctly

**Before pushing to main:**
1. Open a PR with your changes
2. Wait for tests to pass
3. Review breaking change warnings
4. Merge to main

**Note:** Changes to `main` are immediately used by all repos that call this workflow:
- tracells-db
- email-processing
- redcap

### Key Files

- `.github/workflows/review.yml` - Main reusable workflow (called by other repos)
- `src/index.js` - Entry point and orchestration
- `src/reviewers/*.js` - AI reviewer implementations
- `src/github.js` - GitHub API integration
- `src/config.js` - Configuration loading

### Making Safe Changes

**Safe changes** (won't break calling repos):
- Updating reviewer prompts
- Improving error messages
- Adding new config options (with defaults)
- Bug fixes that don't change the interface

**Breaking changes** (require coordination):
- Changing required secrets
- Changing workflow permissions
- Changing the model ID without verification
- Removing config options

For breaking changes:
1. Test in a fork first
2. Update calling repos in the same day
3. Monitor the first PR in each repo after merge

## Security

- Reviews are non-blocking by default
- No execution of untrusted PR code
- All PR content treated as untrusted input
- Uses GitHub's native GITHUB_TOKEN for PR comments
- Only runs on PRs from the same repo (not forks)
- Skips draft PRs to avoid unnecessary costs

## Design Principles

- **Non-blocking**: Assists reviewers, doesn't prevent merges
- **High signal**: Avoids stylistic nitpicks
- **Specialized perspectives**: Each agent has narrow scope
- **Structured output**: Normalized, ranked feedback
- **Cost conscious**: Skips drafts and forks, limits PR size
