#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);
const nodeModulesPath = join(projectRoot, 'node_modules');
const mcpSdkPath = join(nodeModulesPath, '@modelcontextprotocol', 'sdk');

// Check if MCP SDK is installed
if (!existsSync(mcpSdkPath)) {
  try {
    // Install only production dependencies silently
    execSync('npm install --omit=dev --loglevel=error --no-audit --no-fund', {
      cwd: projectRoot,
      stdio: 'ignore'
    });
  } catch (error) {
    console.error('[AI-Context MCP] Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

// Import and run the actual server
import('../dist/index.js').catch(error => {
  console.error('[AI-Context MCP] Failed to start server:', error.message);
  process.exit(1);
});