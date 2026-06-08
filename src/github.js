import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const owner = process.env.REPO_OWNER;
const repo = process.env.REPO_NAME;
const prNumber = parseInt(process.env.PR_NUMBER);
const baseSha = process.env.BASE_SHA;
const headSha = process.env.HEAD_SHA;
const targetRepoPath = process.env.TARGET_REPO_PATH;

export async function fetchPRContext() {
  // Get PR details
  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber
  });

  // Get changed files
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100
  });

  // Get diff for each file
  const filesWithDiff = files.map(file => {
    let diff = '';

    try {
      // Use git diff to get the actual diff content
      diff = execSync(
        `git diff ${baseSha} ${headSha} -- "${file.filename}"`,
        {
          cwd: targetRepoPath,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );
    } catch (err) {
      console.warn(`Could not get diff for ${file.filename}:`, err.message);
    }

    return {
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch || '',
      diff: diff
    };
  });

  return {
    number: prNumber,
    title: pr.title,
    description: pr.body || '',
    author: pr.user.login,
    files: filesWithDiff,
    baseSha,
    headSha
  };
}

export async function postReviewComment({ body, prNumber }) {
  // Check if we've already posted a review
  const { data: comments } = await octokit.issues.listComments({
    owner,
    repo,
    issue_number: prNumber
  });

  const existingReview = comments.find(comment =>
    comment.user.type === 'Bot' &&
    comment.body.includes('🤖 AI Senior Review')
  );

  if (existingReview) {
    // Update existing comment
    await octokit.issues.updateComment({
      owner,
      repo,
      comment_id: existingReview.id,
      body
    });
    console.log('Updated existing review comment');
  } else {
    // Create new comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body
    });
    console.log('Posted new review comment');
  }
}
