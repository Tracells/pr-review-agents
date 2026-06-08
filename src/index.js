#!/usr/bin/env node

import { loadConfig } from './config.js';
import { fetchPRContext } from './github.js';
import { runReviewers } from './reviewers/index.js';
import { postReviewComment } from './github.js';

async function main() {
  console.log('Starting PR review process...');

  // Load configuration
  const config = await loadConfig(process.env.TARGET_REPO_PATH);
  console.log('Configuration loaded:', JSON.stringify(config, null, 2));

  // Fetch PR context
  const prContext = await fetchPRContext();
  console.log(`Reviewing PR #${prContext.number}: ${prContext.title}`);
  console.log(`Files changed: ${prContext.files.length}`);

  // Check if PR is too large
  if (prContext.files.length > config.max_pr_size) {
    console.log(`PR exceeds max size (${prContext.files.length} > ${config.max_pr_size}). Skipping review.`);
    await postReviewComment({
      body: `⚠️ This PR is too large for automated review (${prContext.files.length} files changed, max ${config.max_pr_size}). Consider breaking it into smaller PRs.`,
      prNumber: prContext.number
    });
    return;
  }

  // Run reviewer agents
  const reviews = await runReviewers(prContext, config);
  console.log('Reviews completed:', reviews.length, 'findings');

  // Post aggregated review comment
  await postReviewComment({
    body: formatReviewComment(reviews, config),
    prNumber: prContext.number
  });

  console.log('PR review complete!');
}

function formatReviewComment(reviews, config) {
  const sections = [];

  sections.push('## 🤖 AI Senior Review\n');

  const byReviewer = {
    architecture: [],
    reliability: [],
    security: []
  };

  reviews.forEach(finding => {
    if (finding.severity === 'low' && config.min_severity !== 'low') return;
    if (finding.severity === 'medium' && config.min_severity === 'high') return;

    byReviewer[finding.reviewer].push(finding);
  });

  for (const [reviewer, findings] of Object.entries(byReviewer)) {
    if (!config.reviewers[reviewer]) continue;

    const title = reviewer.charAt(0).toUpperCase() + reviewer.slice(1);
    sections.push(`### ${title} Reviewer\n`);

    if (findings.length === 0) {
      sections.push('✅ No significant concerns identified.\n');
    } else {
      findings.forEach(finding => {
        const emoji = finding.severity === 'high' ? '🔴' : finding.severity === 'medium' ? '🟡' : '🔵';
        sections.push(`${emoji} **${finding.severity.toUpperCase()}**: ${finding.message}\n`);
        if (finding.file) {
          sections.push(`   📄 \`${finding.file}\`${finding.line ? `:${finding.line}` : ''}\n`);
        }
        if (finding.suggestion) {
          sections.push(`   💡 ${finding.suggestion}\n`);
        }
        sections.push('\n');
      });
    }
    sections.push('\n');
  }

  sections.push('---\n');
  sections.push('_This is an automated, non-blocking review. Human review is still required._');

  return sections.join('');
}

main().catch(err => {
  console.error('Error running PR review:', err);
  process.exit(1);
});
