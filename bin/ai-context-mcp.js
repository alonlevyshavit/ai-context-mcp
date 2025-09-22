#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);
const nodeModulesPath = join(projectRoot, 'node_modules');

// Check if dependencies are installed
if (!existsSync(nodeModulesPath)) {
  console.error('[AI-Context MCP] Installing dependencies...');
  try {
    execSync('npm install --production', {
      cwd: projectRoot,
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('[AI-Context MCP] Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

// Import and run the actual server
try {
  const { default: main } = await import('../dist/index.js');
} catch (error) {
  console.error('[AI-Context MCP] Failed to start server:', error.message);
  process.exit(1);
}