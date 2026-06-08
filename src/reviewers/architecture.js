export const architectureReviewer = {
  name: 'architecture',

  buildPrompt(prContext, config) {
    const filesList = prContext.files
      .filter(f => !shouldExcludeFile(f.filename, config.exclude_patterns))
      .map(f => `${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`)
      .join('\n');

    const diffs = prContext.files
      .filter(f => !shouldExcludeFile(f.filename, config.exclude_patterns))
      .map(f => `### ${f.filename}\n\`\`\`diff\n${f.diff || f.patch}\n\`\`\``)
      .join('\n\n');

    return `You are a senior software engineer conducting an architecture and maintainability review of a pull request.

PR Title: ${prContext.title}
PR Description: ${prContext.description}

Files Changed:
${filesList}

Code Changes:
${diffs}

Review this PR focusing on:
- System design and architectural patterns
- Module boundaries and separation of concerns
- Coupling and cohesion
- API design and interface contracts
- Long-term maintainability
- Consistency with existing patterns
- Abstractions and code organization

For each finding, provide:
1. Severity (high/medium/low)
2. File path and line number if applicable
3. Clear description of the issue
4. Concrete suggestion for improvement

Format your response as a JSON array:
[
  {
    "severity": "medium",
    "file": "src/example.ts",
    "line": 42,
    "message": "Brief description of the architectural concern",
    "suggestion": "Specific recommendation"
  }
]

Only report high-confidence findings. Avoid stylistic nitpicks. If there are no significant concerns, return an empty array [].`;
  },

  parseResponse(text) {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const findings = JSON.parse(jsonMatch[0]);

      return findings.map(f => ({
        reviewer: 'architecture',
        severity: f.severity || 'medium',
        file: f.file,
        line: f.line,
        message: f.message,
        suggestion: f.suggestion
      }));
    } catch (err) {
      console.error('Failed to parse architecture review response:', err.message);
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
