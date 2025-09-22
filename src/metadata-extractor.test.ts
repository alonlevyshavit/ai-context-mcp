import { describe, it, expect } from 'vitest';
import { extractMetadata } from './metadata-extractor.js';

describe('extractMetadata', () => {
  describe('YAML frontmatter extraction', () => {
    it('should extract YAML frontmatter correctly', () => {
      const content = `---
description: Test agent
priority: high
tags: [test, demo]
use_cases:
  - Testing functionality
  - Demo purposes
---

# Test Agent

This is the content.`;

      const result = extractMetadata(content);

      expect(result.source).toBe('yaml');
      expect(result.content).toContain('description: Test agent');
      expect(result.content).toContain('priority: high');
      expect(result.content).toContain('tags: [test, demo]');
      expect(result.content).toContain('use_cases:');
      expect(result.content).toContain('- Testing functionality');
    });

    it('should handle YAML with complex values', () => {
      const content = `---
description: "Complex agent with quotes"
multiline: |
  This is a
  multiline value
nested:
  key: value
  list:
    - item1
    - item2
---

# Agent`;

      const result = extractMetadata(content);

      expect(result.source).toBe('yaml');
      expect(result.content).toContain('description: "Complex agent with quotes"');
      expect(result.content).toContain('multiline: |');
      expect(result.content).toContain('nested:');
    });

    it('should handle empty YAML frontmatter', () => {
      const content = `---

---

# Empty Agent`;

      const result = extractMetadata(content);

      expect(result.source).toBe('yaml');
      expect(result.content).toBe('');
    });
  });

  describe('HTML metadata extraction', () => {
    it('should extract HTML metadata comment correctly', () => {
      const content = `<!-- metadata
This is a specialized agent
Role: Architecture specialist
Skills: System design, microservices
Experience: 10+ years
-->

# Architecture Agent

Content here.`;

      const result = extractMetadata(content);

      expect(result.source).toBe('html');
      expect(result.content).toContain('This is a specialized agent');
      expect(result.content).toContain('Role: Architecture specialist');
      expect(result.content).toContain('Skills: System design, microservices');
    });

    it('should handle HTML metadata with extra whitespace', () => {
      const content = `<!--   metadata
  Agent description here
  Type: Helper
  -->

# Agent`;

      const result = extractMetadata(content);

      expect(result.source).toBe('html');
      expect(result.content).toContain('Agent description here');
      expect(result.content).toContain('Type: Helper');
    });
  });

  describe('paragraph extraction fallback', () => {
    it('should extract first paragraph when no metadata', () => {
      const content = `# Test Agent

This is the first paragraph that describes the agent.
It spans multiple sentences and provides context.

This is a second paragraph.

Read: /guidelines/test.md`;

      const result = extractMetadata(content);

      expect(result.source).toBe('paragraph');
      expect(result.content).toBe('This is the first paragraph that describes the agent.\nIt spans multiple sentences and provides context.');
    });

    it('should stop at Read: directive', () => {
      const content = `# Agent

Single line description.
Read: /guidelines/test.md

More content here.`;

      const result = extractMetadata(content);

      expect(result.source).toBe('paragraph');
      expect(result.content).toBe('Single line description.');
    });

    it('should handle content without double newlines', () => {
      const content = `# Agent

Very long content that goes on and on and should be truncated at some reasonable point to avoid overly long descriptions that would clutter the tool metadata and make it hard for LLMs to process efficiently so we need to cut it off somewhere around here.`;

      const result = extractMetadata(content);

      expect(result.source).toBe('paragraph');
      expect(result.content.length).toBeLessThanOrEqual(500);
      expect(result.content).toContain('Very long content');
    });

    it('should handle empty content gracefully', () => {
      const content = `# Agent

`;

      const result = extractMetadata(content);

      expect(result.source).toBe('paragraph');
      expect(result.content).toBe('No description available');
    });

    it('should handle content with only header', () => {
      const content = `# Agent`;

      const result = extractMetadata(content);

      expect(result.source).toBe('paragraph');
      expect(result.content).toBe('# Agent');
    });
  });

  describe('edge cases', () => {
    it('should prioritize YAML over HTML when both present', () => {
      const content = `---
yaml_description: YAML metadata
---

<!-- metadata
html_description: HTML metadata
-->

# Agent`;

      const result = extractMetadata(content);

      expect(result.source).toBe('yaml');
      expect(result.content).toContain('yaml_description: YAML metadata');
      expect(result.content).not.toContain('html_description');
    });

    it('should prioritize HTML over paragraph when present', () => {
      const content = `<!-- metadata
HTML description
-->

# Agent

Paragraph description.`;

      const result = extractMetadata(content);

      expect(result.source).toBe('html');
      expect(result.content).toContain('HTML description');
    });

    it('should handle malformed YAML gracefully', () => {
      const content = `---
invalid: yaml: content:
---

# Agent

Fallback paragraph.`;

      const result = extractMetadata(content);

      expect(result.source).toBe('yaml');
      expect(result.content).toContain('invalid: yaml: content:');
    });
  });
});