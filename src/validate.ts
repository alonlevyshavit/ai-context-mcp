#!/usr/bin/env node
import { extractMetadata } from './metadata-extractor.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ValidationResult {
  valid: Array<{
    file: string;
    source: string;
    description: string;
  }>;
  warnings: Array<{
    file: string;
    message: string;
  }>;
  errors: Array<{
    file: string;
    error: string;
  }>;
}

async function validateDirectory(dir: string): Promise<ValidationResult> {
  const results: ValidationResult = {
    valid: [],
    warnings: [],
    errors: []
  };

  async function scan(currentDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.name.endsWith('.md')) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const metadata = extractMetadata(content);

            const relativePath = path.relative(dir, fullPath);

            if (metadata.source === 'paragraph') {
              results.warnings.push({
                file: relativePath,
                message: 'Using first paragraph - consider adding YAML frontmatter or HTML metadata section'
              });
            } else {
              results.valid.push({
                file: relativePath,
                source: metadata.source,
                description: metadata.content.substring(0, 50) + '...'
              });
            }
          } catch (error) {
            results.errors.push({
              file: path.relative(dir, fullPath),
              error: (error as Error).message
            });
          }
        }
      }
    } catch (error) {
      results.errors.push({
        file: path.relative(dir, currentDir),
        error: `Cannot read directory: ${(error as Error).message}`
      });
    }
  }

  await scan(dir);
  return results;
}

// CLI usage
async function main() {
  const contextRoot = process.argv[2] || '.ai-context';

  try {
    // Check if directory exists
    await fs.access(contextRoot);
  } catch {
    console.error(`Error: Directory '${contextRoot}' does not exist.`);
    console.error('Usage: npm run validate [path-to-ai-context]');
    process.exit(1);
  }

  console.log(`\nValidating metadata extraction in: ${contextRoot}\n`);

  const results = await validateDirectory(contextRoot);

  console.log('✓ Valid files:', results.valid.length);
  results.valid.forEach(v => console.log(`  ${v.file} (${v.source}): ${v.description}`));

  if (results.warnings.length > 0) {
    console.log('\n⚠ Warnings:', results.warnings.length);
    results.warnings.forEach(w => console.log(`  ${w.file}: ${w.message}`));
  }

  if (results.errors.length > 0) {
    console.log('\n✗ Errors:', results.errors.length);
    results.errors.forEach(e => console.log(`  ${e.file}: ${e.error}`));
    process.exit(1);
  }

  console.log('\n✓ Validation complete');
}

main().catch(console.error);