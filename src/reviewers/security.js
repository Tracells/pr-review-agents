export const securityReviewer = {
  name: 'security',

  buildPrompt(prContext, config) {
    const filesList = prContext.files
      .filter(f => !shouldExcludeFile(f.filename, config.exclude_patterns))
      .map(f => `${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`)
      .join('\n');

    const diffs = prContext.files
      .filter(f => !shouldExcludeFile(f.filename, config.exclude_patterns))
      .map(f => `### ${f.filename}\n\`\`\`diff\n${f.diff || f.patch}\n\`\`\``)
      .join('\n\n');

    return `You are a senior software engineer conducting a security and privacy review of a pull request.

PR Title: ${prContext.title}
PR Description: ${prContext.description}

Files Changed:
${filesList}

Code Changes:
${diffs}

Review this PR focusing on:
- Authentication and authorization risks
- Secrets and credentials exposure
- Input validation and sanitization
- SQL injection, XSS, and injection attacks
- Data leakage and exposure
- Unsafe logging of sensitive data
- Privacy-sensitive data handling
- Insecure dependencies or configurations
- CSRF, SSRF, and other web vulnerabilities
- Cryptography and secure random generation
- Access control bypasses

For each finding, provide:
1. Severity (high/medium/low)
2. File path and line number if applicable
3. Clear description of the security concern
4. Concrete suggestion for remediation

Format your response as a JSON array:
[
  {
    "severity": "high",
    "file": "src/example.ts",
    "line": 42,
    "message": "Brief description of the security concern",
    "suggestion": "Specific remediation recommendation"
  }
]

Only report high-confidence security findings. Focus on actual vulnerabilities, not theoretical risks. If there are no significant concerns, return an empty array [].`;
  },

  parseResponse(text) {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const findings = JSON.parse(jsonMatch[0]);

      return findings.map(f => ({
        reviewer: 'security',
        severity: f.severity || 'medium',
        file: f.file,
        line: f.line,
        message: f.message,
        suggestion: f.suggestion
      }));
    } catch (err) {
      console.error('Failed to parse security review response:', err.message);
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
