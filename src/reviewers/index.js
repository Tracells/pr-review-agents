import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { architectureReviewer } from './architecture.js';
import { reliabilityReviewer } from './reliability.js';
import { securityReviewer } from './security.js';

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

export async function runReviewers(prContext, config) {
  const reviewers = [];

  if (config.reviewers.architecture) {
    reviewers.push(architectureReviewer);
  }
  if (config.reviewers.reliability) {
    reviewers.push(reliabilityReviewer);
  }
  if (config.reviewers.security) {
    reviewers.push(securityReviewer);
  }

  console.log(`Running ${reviewers.length} reviewers in parallel...`);

  // Run all reviewers in parallel
  const results = await Promise.all(
    reviewers.map(reviewer => runReviewer(reviewer, prContext, config))
  );

  // Flatten and deduplicate findings
  const allFindings = results.flat();
  return deduplicateFindings(allFindings);
}

async function runReviewer(reviewer, prContext, config) {
  console.log(`Starting ${reviewer.name} review...`);

  try {
    const prompt = reviewer.buildPrompt(prContext, config);

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      temperature: 0,
      messages: [{
        role: 'user',
        content: prompt
      }]
    };

    const command = new InvokeModelCommand({
      modelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const findings = reviewer.parseResponse(responseBody.content[0].text);
    console.log(`${reviewer.name} found ${findings.length} issues`);

    return findings;
  } catch (err) {
    console.error(`Error in ${reviewer.name}:`, err.message);
    return [];
  }
}

function deduplicateFindings(findings) {
  const seen = new Map();

  findings.forEach(finding => {
    const key = `${finding.file}:${finding.message}`;

    if (!seen.has(key)) {
      seen.set(key, finding);
    } else {
      // Keep the higher severity if duplicate
      const existing = seen.get(key);
      const severityRank = { high: 3, medium: 2, low: 1 };

      if (severityRank[finding.severity] > severityRank[existing.severity]) {
        seen.set(key, finding);
      }
    }
  });

  return Array.from(seen.values());
}
