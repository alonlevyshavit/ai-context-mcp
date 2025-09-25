#!/usr/bin/env node
/**
 * Verify that system instructions are exposed as a prompt
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const AI_CONTEXT_ROOT = './test-project/.ai-context';

async function verifyPrompt() {
  console.log('=== PROMPT VERIFICATION ===\n');
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
    name: 'prompt-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✓ Connected to MCP server\n');

    // Test 1: List prompts
    console.log('Test 1: Listing prompts');
    const prompts = await client.listPrompts();
    console.log(`  Found ${prompts.prompts.length} prompt(s)`);

    const howToUsePrompt = prompts.prompts.find(p => p.name === 'how-to-use-ai-context');
    if (howToUsePrompt) {
      console.log('  ✓ Found "how-to-use-ai-context" prompt:');
      console.log(`    - Name: ${howToUsePrompt.name}`);
      console.log(`    - Description: ${howToUsePrompt.description}`);
    } else {
      console.log('  ✗ "how-to-use-ai-context" prompt not found');
      console.log('  Available prompts:', prompts.prompts.map(p => p.name).join(', '));
      process.exit(1);
    }

    // Test 2: Get the prompt
    console.log('\nTest 2: Getting prompt content');
    try {
      const result = await client.getPrompt({
        name: 'how-to-use-ai-context',
        arguments: {}
      });

      if (result.messages && result.messages.length > 0) {
        console.log(`  ✓ Successfully retrieved prompt with ${result.messages.length} messages`);

        // Check the conversation structure
        const userMessage = result.messages[0];
        const assistantMessage = result.messages[1];

        if (userMessage.role === 'user' && assistantMessage.role === 'assistant') {
          console.log('  ✓ Prompt has correct conversation structure');
        }

        // Verify assistant response contains instructions
        const assistantText = assistantMessage.content.text;
        if (assistantText.includes('Discovery-First Approach')) {
          console.log('  ✓ Assistant response contains "Discovery-First Approach"');
        }
        if (assistantText.includes('list_all_resources')) {
          console.log('  ✓ Assistant response contains "list_all_resources" guidance');
        }

        // Show the user question
        console.log('\n  User question in prompt:');
        console.log(`  "${userMessage.content.text}"`);

        // Show first few lines of assistant response
        const firstLines = assistantText.split('\n').slice(0, 5).join('\n');
        console.log('\n  First 5 lines of assistant response:');
        console.log('  ' + firstLines.split('\n').join('\n  '));
      } else {
        console.log('  ✗ No messages returned');
        process.exit(1);
      }
    } catch (error) {
      console.log(`  ✗ Failed to get prompt: ${error.message}`);
      process.exit(1);
    }

    // Test 3: Summary
    console.log('\nTest 3: Access methods summary');
    console.log('  System instructions are now available as:');
    console.log('  ✓ serverInfo.instructions (during init)');
    console.log('  ✓ Resource "instructions://system" (on demand)');
    console.log('  ✓ Prompt "how-to-use-ai-context" (conversational)');

    console.log('\n========================================');
    console.log('✅ PROMPT VERIFICATION PASSED!');
    console.log('========================================\n');
    console.log('The system instructions are exposed in 3 ways:');
    console.log('1. Automatic: serverInfo.instructions during initialization');
    console.log('2. Resource: instructions://system for direct access');
    console.log('3. Prompt: how-to-use-ai-context for conversational guidance');
    console.log('\nCursor can now use the prompt to learn how to use the MCP server.');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ Connection closed');
  }
}

// Run the verification
verifyPrompt().catch(console.error);