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
    // First try npm install
    execSync('npm install --omit=dev', {
      cwd: projectRoot,
      stdio: ['ignore', 'ignore', 'inherit']
    });

    // Verify the MCP SDK was installed
    const mcpSdkPath = join(nodeModulesPath, '@modelcontextprotocol', 'sdk');
    if (!existsSync(mcpSdkPath)) {
      throw new Error('@modelcontextprotocol/sdk was not installed');
    }

    console.error('[AI-Context MCP] Dependencies installed successfully');
  } catch (error) {
    console.error('[AI-Context MCP] Failed to install dependencies:', error.message);
    console.error('[AI-Context MCP] Error details:', error.toString());
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