export const reliabilityReviewer = {
  name: 'reliability',

  buildPrompt(prContext, config) {
    const filesList = prContext.files
      .filter(f => !shouldExcludeFile(f.filename, config.exclude_patterns))
      .map(f => `${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`)
      .join('\n');

    const diffs = prContext.files
      .filter(f => !shouldExcludeFile(f.filename, config.exclude_patterns))
      .map(f => `### ${f.filename}\n\`\`\`diff\n${f.diff || f.patch}\n\`\`\``)
      .join('\n\n');

    return `You are a senior software engineer conducting a reliability and correctness review of a pull request.

PR Title: ${prContext.title}
PR Description: ${prContext.description}

Files Changed:
${filesList}

Code Changes:
${diffs}

Review this PR focusing on:
- Correctness and logic errors
- Edge cases and boundary conditions
- Error handling and failure modes
- Retry logic and circuit breakers
- Race conditions and concurrency issues
- Resource leaks and cleanup
- Observability (logging, metrics, tracing)
- Performance risks and bottlenecks
- Operational failure scenarios

For each finding, provide:
1. Severity (high/medium/low)
2. File path and line number if applicable
3. Clear description of the reliability concern
4. Concrete suggestion for improvement

Format your response as a JSON array:
[
  {
    "severity": "high",
    "file": "src/example.ts",
    "line": 42,
    "message": "Brief description of the reliability concern",
    "suggestion": "Specific recommendation"
  }
]

Only report high-confidence findings. Focus on issues that could cause runtime failures, data loss, or operational problems. If there are no significant concerns, return an empty array [].`;
  },

  parseResponse(text) {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const findings = JSON.parse(jsonMatch[0]);

      return findings.map(f => ({
        reviewer: 'reliability',
        severity: f.severity || 'medium',
        file: f.file,
        line: f.line,
        message: f.message,
        suggestion: f.suggestion
      }));
    } catch (err) {
      console.error('Failed to parse reliability review response:', err.message);
      return [];
    }
  }
};

function shouldExcludeFile(filename, patterns) {
  return patterns.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    return regex.test(filename);
  });
}
