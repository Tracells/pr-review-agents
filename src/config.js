import { readFile } from 'fs/promises';
import { join } from 'path';
import YAML from 'yaml';

const DEFAULT_CONFIG = {
  reviewers: {
    architecture: true,
    reliability: true,
    security: true
  },
  min_severity: 'low',
  exclude_patterns: [
    '**/*.test.js',
    '**/*.test.ts',
    '**/*.spec.js',
    '**/*.spec.ts',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/fixtures/**',
    '**/mocks/**'
  ],
  max_pr_size: 50
};

export async function loadConfig(repoPath) {
  const configPath = join(repoPath, '.github', 'pr-review.yml');

  try {
    const content = await readFile(configPath, 'utf-8');
    const userConfig = YAML.parse(content);

    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      reviewers: {
        ...DEFAULT_CONFIG.reviewers,
        ...(userConfig.reviewers || {})
      }
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('No custom config found, using defaults');
      return DEFAULT_CONFIG;
    }
    throw err;
  }
}
