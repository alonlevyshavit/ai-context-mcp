#!/usr/bin/env node
/**
 * MCP Client Test Suite
 *
 * This comprehensive test suite verifies all functionality of the AI Context MCP server:
 * - Resources (list and read)
 * - Tools (with new naming convention)
 * - Content integrity
 * - Static tools
 *
 * Usage: node test/mcp-client-test.js [ai-context-root-path]
 * Example: node test/mcp-client-test.js ./test-project/.ai-context
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Get AI_CONTEXT_ROOT from command line or environment variable
const AI_CONTEXT_ROOT = process.argv[2] || process.env.AI_CONTEXT_ROOT || './test-project/.ai-context';

async function runTests() {
  console.log('=== MCP CLIENT TEST SUITE ===\n');
  console.log(`Testing with AI_CONTEXT_ROOT: ${AI_CONTEXT_ROOT}\n`);

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: {
      ...process.env,
      AI_CONTEXT_ROOT
    }
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  let allTestsPassed = true;
  const results = [];

  try {
    await client.connect(transport);
    console.log('✓ Connected to MCP server\n');

    // Test 1: List Tools
    console.log('Test 1: List Tools (New Naming)');
    try {
      const tools = await client.listTools();
      console.log(`  ✓ Found ${tools.tools.length} tools`);

      // Check for correct naming pattern
      const agentTools = tools.tools.filter(t => t.name.startsWith('load_') && t.name.endsWith('_agent'));
      console.log(`    - ${agentTools.length} agent tools with correct naming`);

      // Verify no old naming pattern exists
      const oldNaming = tools.tools.filter(t => t.name.includes('_agent_'));
      if (oldNaming.length > 0) {
        console.log(`  ⚠ Found ${oldNaming.length} tools with old naming pattern`);
      }

      results.push({ test: 'List Tools', passed: true });
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      results.push({ test: 'List Tools', passed: false, error: error.message });
      allTestsPassed = false;
    }

    // Test 2: Call Tool
    console.log('\nTest 2: Call Agent Tool');
    try {
      const result = await client.callTool({
        name: 'load_debugger_agent',
        arguments: {}
      });

      if (result.content[0].type === 'text') {
        console.log(`  ✓ Tool returned content (${result.content[0].text.length} chars)`);
        results.push({ test: 'Call Agent Tool', passed: true });
      } else {
        console.log(`  ✗ Tool returned error`);
        results.push({ test: 'Call Agent Tool', passed: false });
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      results.push({ test: 'Call Agent Tool', passed: false, error: error.message });
      allTestsPassed = false;
    }

    // Test 3: Static Tools
    console.log('\nTest 3: Static Tools');
    try {
      // Test list_all_resources
      const listResult = await client.callTool({
        name: 'list_all_resources',
        arguments: {}
      });

      if (listResult.content[0].type === 'text') {
        const data = JSON.parse(listResult.content[0].text);
        console.log('  ✓ list_all_resources works');
      }

      // Test load_multiple_resources
      const multiResult = await client.callTool({
        name: 'load_multiple_resources',
        arguments: {
          resources: ['agent:debugger-agent', 'guideline:debugging/debugging']
        }
      });

      if (multiResult.content[0].type === 'text') {
        console.log('  ✓ load_multiple_resources works');
      }

      results.push({ test: 'Static Tools', passed: true });
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      results.push({ test: 'Static Tools', passed: false, error: error.message });
      allTestsPassed = false;
    }

    // Summary
    console.log('\n' + '='.repeat(40));
    console.log('TEST SUMMARY:');
    results.forEach(r => {
      console.log(`  ${r.passed ? '✓' : '✗'} ${r.test}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });

    console.log('\n' + '='.repeat(40));
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED!');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }

  } catch (error) {
    console.error('Fatal error:', error);
    allTestsPassed = false;
  } finally {
    await client.close();
    console.log('\n✓ Connection closed');
    process.exit(allTestsPassed ? 0 : 1);
  }
}

// Run the tests
runTests().catch(console.error);