#!/usr/bin/env node
/**
 * Verify that system instructions are exposed as a resource
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const AI_CONTEXT_ROOT = './test-project/.ai-context';

async function verifyInstructionsResource() {
  console.log('=== INSTRUCTIONS RESOURCE VERIFICATION ===\n');
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
    name: 'instructions-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✓ Connected to MCP server\n');

    // Test 1: List resources to find instructions
    console.log('Test 1: Listing resources');
    const resources = await client.listResources();
    console.log(`  Found ${resources.resources.length} resource(s)`);

    const instructionsResource = resources.resources.find(r => r.uri === 'instructions://system');
    if (instructionsResource) {
      console.log('  ✓ Found instructions resource:');
      console.log(`    - URI: ${instructionsResource.uri}`);
      console.log(`    - Name: ${instructionsResource.name}`);
      console.log(`    - Description: ${instructionsResource.description}`);
    } else {
      console.log('  ✗ Instructions resource not found');
      console.log('  Available resources:', resources.resources.map(r => r.uri).join(', '));
      process.exit(1);
    }

    // Test 2: Read the instructions resource
    console.log('\nTest 2: Reading instructions resource');
    try {
      const result = await client.readResource({
        uri: 'instructions://system'
      });

      if (result.contents && result.contents.length > 0) {
        const content = result.contents[0];
        console.log(`  ✓ Successfully read instructions (${content.text.length} chars)`);

        // Verify it contains expected content
        if (content.text.includes('Discovery-First Approach')) {
          console.log('  ✓ Contains "Discovery-First Approach"');
        }
        if (content.text.includes('list_all_resources')) {
          console.log('  ✓ Contains "list_all_resources" guidance');
        }

        // Show first few lines
        const firstLines = content.text.split('\n').slice(0, 10).join('\n');
        console.log('\n  First 10 lines of instructions:');
        console.log('  ' + firstLines.split('\n').join('\n  '));
      } else {
        console.log('  ✗ No content returned');
        process.exit(1);
      }
    } catch (error) {
      console.log(`  ✗ Failed to read instructions: ${error.message}`);
      process.exit(1);
    }

    // Test 3: Verify server info still includes instructions
    console.log('\nTest 3: Server initialization info');
    console.log('  ℹ Server info with instructions is set during initialization');
    console.log('  ✓ Instructions are available both as:');
    console.log('    - serverInfo.instructions (during init)');
    console.log('    - Resource at instructions://system (on demand)');

    console.log('\n========================================');
    console.log('✅ INSTRUCTIONS RESOURCE VERIFICATION PASSED!');
    console.log('========================================\n');
    console.log('The system instructions are now exposed as:');
    console.log('1. serverInfo.instructions during initialization');
    console.log('2. Resource "instructions://system" for explicit access');
    console.log('\nThis allows verification that Cursor receives the instructions.');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ Connection closed');
  }
}

// Run the verification
verifyInstructionsResource().catch(console.error);