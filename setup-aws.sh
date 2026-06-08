#!/bin/bash
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  PR Review Agents - AWS Setup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

# Get AWS account ID
echo -e "${YELLOW}Fetching AWS account ID...${NC}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}Error: Could not determine AWS account ID${NC}"
    echo "Make sure you have AWS credentials configured (aws configure)"
    exit 1
fi
echo -e "${GREEN}AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"
echo ""

# Step 1: Create OIDC Provider
echo -e "${YELLOW}Step 1/5: Checking OIDC provider...${NC}"
OIDC_PROVIDER_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_PROVIDER_ARN" &> /dev/null; then
    echo -e "${GREEN}✓ OIDC provider already exists${NC}"
else
    echo "Creating OIDC provider for GitHub Actions..."
    aws iam create-open-id-connect-provider \
        --url https://token.actions.githubusercontent.com \
        --client-id-list sts.amazonaws.com \
        --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
    echo -e "${GREEN}✓ OIDC provider created${NC}"
fi
echo ""

# Step 2: Create trust policy
echo -e "${YELLOW}Step 2/5: Creating trust policy...${NC}"
cat > /tmp/github-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_PROVIDER_ARN}"
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
EOF
echo -e "${GREEN}✓ Trust policy created${NC}"
echo ""

# Step 3: Create IAM role
echo -e "${YELLOW}Step 3/5: Creating IAM role...${NC}"
ROLE_NAME="GitHubActions-BedrockPRReview"

if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    echo -e "${YELLOW}Role already exists, updating trust policy...${NC}"
    aws iam update-assume-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-document file:///tmp/github-trust-policy.json
    echo -e "${GREEN}✓ Trust policy updated${NC}"
else
    echo "Creating IAM role..."
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/github-trust-policy.json \
        --description "Role for GitHub Actions to invoke Bedrock for PR reviews"
    echo -e "${GREEN}✓ IAM role created${NC}"
fi
echo ""

# Step 4: Create and attach Bedrock policy
echo -e "${YELLOW}Step 4/5: Creating Bedrock permissions policy...${NC}"
POLICY_NAME="BedrockInvokeModel"
POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${POLICY_NAME}"

cat > /tmp/bedrock-policy.json <<EOF
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
EOF

if aws iam get-policy --policy-arn "$POLICY_ARN" &> /dev/null; then
    echo -e "${GREEN}✓ Policy already exists${NC}"
else
    echo "Creating Bedrock policy..."
    aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document file:///tmp/bedrock-policy.json \
        --description "Allows invoking Claude Sonnet 4.5 on Bedrock"
    echo -e "${GREEN}✓ Bedrock policy created${NC}"
fi

# Attach policy to role
echo "Attaching policy to role..."
if aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "$POLICY_ARN" 2>&1 | grep -q "already attached"; then
    echo -e "${GREEN}✓ Policy already attached${NC}"
else
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "$POLICY_ARN"
    echo -e "${GREEN}✓ Policy attached to role${NC}"
fi
echo ""

# Step 5: Get role ARN
echo -e "${YELLOW}Step 5/5: Getting role details...${NC}"
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""

# Cleanup temp files
rm -f /tmp/github-trust-policy.json /tmp/bedrock-policy.json

# Final output
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Role ARN:${NC}"
echo "$ROLE_ARN"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Enable Claude Sonnet 4.5 in AWS Bedrock Console:"
echo "   https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess"
echo ""
echo "2. Add these secrets to GitHub (Organization or Repository level):"
echo ""
echo -e "   Secret Name:  ${GREEN}AWS_ROLE_ARN${NC}"
echo "   Secret Value: $ROLE_ARN"
echo ""
echo -e "   Secret Name:  ${GREEN}AWS_REGION${NC}"
echo "   Secret Value: us-east-1"
echo ""
echo "3. Merge the config branches to main in your repositories:"
echo "   - tracells-db"
echo "   - email-processing"
echo "   - redcap"
echo ""
echo "4. Create a test PR to verify the workflow runs!"
echo ""
echo -e "${BLUE}========================================${NC}"
