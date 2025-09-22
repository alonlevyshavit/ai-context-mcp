# AI Context MCP Server - Refined Implementation Plan

## Overview

A standalone MCP server that provides orchestration for any repository using the `.ai-context` framework. This server lives in its own GitHub repository and can be used by multiple projects without any installation - it runs directly from GitHub via npx. The server automatically discovers and loads agents, guidelines, and frameworks from any project's `.ai-context` folder.

## Quick Start

For any project with a `.ai-context` folder, just add this configuration:

**Cursor (`.cursor/mcp.json`):**
```json
{
  "mcpServers": {
    "ai-context": {
      "command": "npx",
      "args": ["github:your-org/ai-context-mcp"]
    }
  }
}
```

That's it! No installation needed. The server will:
1. Download automatically from GitHub
2. Build itself if needed
3. Find your `.ai-context` folder
4. Provide tools for loading agents, guidelines, and frameworks

## Architecture

### Standalone MCP Server Repository
```
ai-context-mcp/                  # Separate GitHub repository
├── package.json
├── README.md
├── LICENSE
├── tsconfig.json
├── .github/
│   └── workflows/
│       ├── test.yml
│       └── build.yml
├── src/
│   ├── index.ts                # Main server with dynamic tool generation
│   ├── scanner.ts              # Directory scanning with metadata extraction
│   ├── loader.ts               # Content loading logic
│   ├── metadata-extractor.ts   # Robust metadata extraction with fallbacks
│   └── types.ts                # TypeScript interfaces
├── dist/                        # Compiled JavaScript (must be committed)
└── examples/
    ├── cursor-config.json       # Example Cursor configuration
    ├── claude-config.json       # Example Claude Desktop configuration
    └── example-agent.md         # Example agent with metadata
```

### Project Using the MCP Server
```
any-project/                     # Your actual project
├── .ai-context/                 # Project's AI context
│   ├── agents/
│   ├── guidelines/
│   └── frameworks/
├── .cursor/
│   └── mcp.json                 # Points to external MCP server
└── [project files...]
```

## Metadata Extraction System

The server uses a robust multi-fallback metadata extraction system that supports multiple formats:

### Metadata Extraction Implementation

```typescript
interface ExtractedMetadata {
  description: string;
  useCases?: string[];
  category?: string;
  purpose?: string;
  components?: string[];
  source: 'yaml' | 'html' | 'markdown' | 'fallback';
}

export function extractMetadata(content: string, type: 'agent' | 'guideline' | 'framework'): ExtractedMetadata {
  // Try extraction methods in order of preference
  let metadata: ExtractedMetadata | null = null;
  
  // 1. Try YAML frontmatter
  metadata = extractYamlFrontmatter(content);
  if (metadata) return { ...metadata, source: 'yaml' };
  
  // 2. Try HTML comment
  metadata = extractHtmlComment(content);
  if (metadata) return { ...metadata, source: 'html' };
  
  // 3. Try markdown convention
  metadata = extractMarkdownHeaders(content, type);
  if (metadata) return { ...metadata, source: 'markdown' };
  
  // 4. Fallback: just grab the first meaningful content
  return extractFallback(content);
}

// Method 1: YAML Frontmatter
function extractYamlFrontmatter(content: string): ExtractedMetadata | null {
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!yamlMatch) return null;
  
  try {
    // Simple YAML parsing without external dependency
    const yamlContent = yamlMatch[1];
    const metadata: any = {};
    
    // Parse simple key-value pairs and lists
    const lines = yamlContent.split('\n');
    let currentKey = '';
    let currentList: string[] = [];
    
    for (const line of lines) {
      // Handle simple key: value
      if (line.includes(':') && !line.startsWith(' ')) {
        if (currentKey && currentList.length > 0) {
          metadata[currentKey] = currentList;
          currentList = [];
        }
        const [key, ...valueParts] = line.split(':');
        currentKey = key.trim();
        const value = valueParts.join(':').trim();
        if (value && !value.startsWith('|') && value !== '') {
          metadata[currentKey] = value.replace(/^["']|["']$/g, '');
          currentKey = '';
        }
      }
      // Handle list items
      else if (line.trim().startsWith('-')) {
        const item = line.trim().substring(1).trim();
        currentList.push(item);
      }
    }
    
    // Add last list if exists
    if (currentKey && currentList.length > 0) {
      metadata[currentKey] = currentList;
    }
    
    return metadata as ExtractedMetadata;
  } catch {
    return null;
  }
}

// Method 2: HTML Comment
function extractHtmlComment(content: string): ExtractedMetadata | null {
  const commentMatch = content.match(/<!--\s*metadata\s*\n([\s\S]*?)\s*-->/);
  if (!commentMatch) return null;
  
  const metadata: any = {};
  const lines = commentMatch[1].split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();
    
    // Handle semicolon-separated lists
    if (key === 'use_cases' || key === 'useCases' || key === 'components') {
      metadata[key.replace('_', 'C')] = value.split(';').map(s => s.trim()).filter(Boolean);
    } else {
      metadata[key] = value;
    }
  }
  
  return metadata;
}

// Method 3: Markdown Headers Convention
function extractMarkdownHeaders(content: string, type: string): ExtractedMetadata | null {
  const metadata: any = {};
  
  // Try to find description after main header
  const titleMatch = content.match(/^#\s+[^\n]+\n+([^\n]+)/);
  if (titleMatch && !titleMatch[1].startsWith('#') && !titleMatch[1].startsWith('*')) {
    metadata.description = titleMatch[1].trim();
  }
  
  // Look for bold markers followed by content
  const patterns: Record<string, RegExp> = {
    description: /\*\*Description:\*\*\s*([^\n]+)/i,
    purpose: /\*\*Purpose:\*\*\s*([^\n]+)/i,
    category: /\*\*Category:\*\*\s*([^\n]+)/i,
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = content.match(pattern);
    if (match) {
      metadata[key] = match[1].trim();
    }
  }
  
  // Extract lists after keywords
  const listPatterns: Record<string, RegExp> = {
    useCases: /\*\*Use (?:Cases?|this .*? when):\*\*\s*\n((?:[-*]\s+[^\n]+\n?)+)/i,
    components: /\*\*Components?:\*\*\s*\n((?:[-*]\s+[^\n]+\n?)+)/i,
  };
  
  for (const [key, pattern] of Object.entries(listPatterns)) {
    const match = content.match(pattern);
    if (match) {
      metadata[key] = match[1]
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^[-*]\s+/, '').trim());
    }
  }
  
  // Return null if we didn't find enough metadata
  if (!metadata.description) return null;
  
  return metadata;
}

// Method 4: Fallback - just extract first meaningful content
function extractFallback(content: string): ExtractedMetadata {
  // Remove the header
  const withoutHeader = content.replace(/^#[^\n]*\n+/, '');
  
  // Find first paragraph or content before "Read:" directives
  const beforeReads = withoutHeader.split(/\nRead:/)[0];
  
  // Take first paragraph (up to double newline) or first 500 chars
  let description = '';
  const paragraphEnd = beforeReads.indexOf('\n\n');
  
  if (paragraphEnd !== -1 && paragraphEnd < 500) {
    description = beforeReads.substring(0, paragraphEnd);
  } else {
    // Take up to 500 chars, but try to end at a sentence
    description = beforeReads.substring(0, 500);
    const lastPeriod = description.lastIndexOf('.');
    const lastNewline = description.lastIndexOf('\n');
    const cutPoint = Math.max(lastPeriod, lastNewline);
    if (cutPoint > 200) {
      description = description.substring(0, cutPoint + 1);
    }
  }
  
  // Clean up the description
  description = description
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return {
    description: description || 'No description available',
    source: 'fallback'
  };
}
```

### Supported Metadata Formats

#### Format 1: YAML Frontmatter (Preferred)
```markdown
---
description: Debugging specialist for systematic error resolution
use_cases:
  - Fixing bugs or errors in code
  - Analyzing error messages
  - Troubleshooting failing tests
category: development
---
# Debugger Agent
[content...]
```

#### Format 2: HTML Comment
```markdown
<!-- metadata
description: Debugging specialist for systematic error resolution
use_cases: Fixing bugs; Analyzing errors; Troubleshooting tests
category: development
-->
# Debugger Agent
[content...]
```

#### Format 3: Markdown Convention
```markdown
# Debugger Agent

**Description:** Debugging specialist for systematic error resolution

**Category:** development

**Use Cases:**
- Fixing bugs or errors in code
- Analyzing error messages
[content...]
```

#### Format 4: Natural Language (Fallback)
```markdown
# Debugger Agent

You are a debugging specialist focused on systematically identifying
and fixing code errors. You excel at analyzing stack traces, 
understanding error patterns, and providing clear solutions.

Read: /guidelines/debugging.md
```

## Installation Method

### Primary Method: Direct from GitHub via npx

No installation needed! The MCP server runs directly from GitHub:

```json
{
  "mcpServers": {
    "ai-context": {
      "command": "npx",
      "args": ["github:your-org/ai-context-mcp"]
    }
  }
}
```

This will automatically:
1. Download the latest version from GitHub
2. Build it if needed
3. Run the server
4. Find your project's `.ai-context` folder

### Alternative: Local Development

For development or offline use:

```bash
# Clone the repository
git clone https://github.com/your-org/ai-context-mcp.git ~/tools/ai-context-mcp
cd ~/tools/ai-context-mcp
npm install
npm run build
```

Project Configuration:
```json
{
  "mcpServers": {
    "ai-context": {
      "command": "node",
      "args": ["~/tools/ai-context-mcp/dist/index.js"]
    }
  }
}
```

## Path Resolution Strategy

The MCP server automatically finds the `.ai-context` folder using this priority:

```typescript
class AiContextMCPServer {
  private findAiContextRoot(): string {
    const fs = require('fs');
    const path = require('path');
    
    // 1. Check explicit environment variable
    if (process.env.AI_CONTEXT_ROOT) {
      const explicitPath = path.resolve(process.env.AI_CONTEXT_ROOT);
      if (fs.existsSync(explicitPath)) {
        return explicitPath;
      }
    }
    
    // 2. Check current working directory for .ai-context
    const cwd = process.cwd();
    const cwdContext = path.join(cwd, '.ai-context');
    if (fs.existsSync(cwdContext)) {
      return cwdContext;
    }
    
    // 3. Search up the directory tree from CWD
    let currentDir = cwd;
    while (currentDir !== path.dirname(currentDir)) {
      const contextPath = path.join(currentDir, '.ai-context');
      if (fs.existsSync(contextPath)) {
        return contextPath;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // 4. Error if not found
    throw new Error(
      'No .ai-context folder found. Please ensure you have a .ai-context folder ' +
      'in your project root or set AI_CONTEXT_ROOT environment variable.'
    );
  }
}
```

## Tool Definitions

### Dynamic Agent-Specific Tools

The server dynamically creates a specific tool for each agent it discovers:

```typescript
// Example: After scanning, these tools are registered:
{
  name: "load_agent_planner",
  description: `
    Loads the planner agent for task breakdown and project planning.
    
    Use this agent when:
    - Breaking down complex tasks into smaller steps
    - Creating project roadmaps
    - Organizing work into manageable chunks
    - Planning implementation strategies
    - Structuring multi-phase projects
    
    The planner agent provides structured approaches to decompose problems
    and create actionable plans.
  `,
  inputSchema: {
    type: "object",
    properties: {}
  }
}
```

### Static Tools (Always Present)

```typescript
{
  name: "list_available_resources",
  description: "Lists all available agents, guidelines, and frameworks in the system",
  inputSchema: {
    type: "object",
    properties: {}
  }
}

{
  name: "load_multiple_agents",
  description: "Load multiple agents simultaneously for complex tasks",
  inputSchema: {
    type: "object",
    properties: {
      agents: {
        type: "array",
        items: { type: "string" },
        description: "Agent names to load (e.g., ['planner', 'debugger'])"
      }
    },
    required: ["agents"]
  }
}

{
  name: "load_guideline",
  description: "Load a specific guideline file directly",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Guideline path (e.g., 'development/api-design')"
      }
    },
    required: ["path"]
  }
}

{
  name: "load_framework",
  description: "Load a framework's README documentation",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Framework name (e.g., 'structured-memory')"
      }
    },
    required: ["name"]
  }
}
```

## Implementation

### Main Server (index.ts)

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { Scanner } from './scanner.js';
import { Loader } from './loader.js';
import * as fs from 'fs/promises';
import * as path from 'path';

class AiContextMCPServer {
  private server: Server;
  private rootPath: string;
  private agentsMetadata: Map<string, any> = new Map();
  private guidelinesMetadata: Map<string, any> = new Map();
  private frameworksMetadata: Map<string, any> = new Map();
  private dynamicTools: any[] = [];
  
  constructor() {
    this.rootPath = this.findAiContextRoot();
    
    this.server = new Server(
      {
        name: 'ai-context-mcp',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
  }
  
  private async initialize() {
    console.error('[AI-Context MCP] Scanning for resources...');
    
    const scanner = new Scanner(this.rootPath);
    
    // Scan all resources with metadata extraction
    this.agentsMetadata = await scanner.scanAgentsWithMetadata();
    this.guidelinesMetadata = await scanner.scanGuidelinesWithMetadata();
    this.frameworksMetadata = await scanner.scanFrameworksWithMetadata();
    
    // Generate dynamic tools for each resource
    this.generateDynamicTools();
    
    console.error(`[AI-Context MCP] Found:`);
    console.error(`  - ${this.agentsMetadata.size} agents`);
    console.error(`  - ${this.guidelinesMetadata.size} guidelines`);
    console.error(`  - ${this.frameworksMetadata.size} frameworks`);
    console.error(`[AI-Context MCP] Generated ${this.dynamicTools.length} tools total`);
    
    this.setupHandlers();
  }
  
  private generateDynamicTools() {
    // Generate tools for agents
    for (const [agentName, metadata] of this.agentsMetadata) {
      const toolName = `load_agent_${agentName.replace(/-/g, '_')}`;
      
      let description = metadata.description + '\n\n';
      
      if (metadata.useCases && metadata.useCases.length > 0) {
        description += 'Use this agent when:\n';
        metadata.useCases.forEach(useCase => {
          description += `- ${useCase}\n`;
        });
      }
      
      this.dynamicTools.push({
        name: toolName,
        description: description.trim(),
        inputSchema: {
          type: "object",
          properties: {}
        }
      });
    }
    
    // Similar generation for guidelines and frameworks...
  }
  
  private setupHandlers() {
    // Register all tools (dynamic + static)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const staticTools = this.getStaticTools();
      return {
        tools: [...this.dynamicTools, ...staticTools]
      };
    });
    
    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        // Handle dynamic agent loading tools
        if (name.startsWith('load_agent_')) {
          const agentName = name.replace('load_agent_', '').replace(/_/g, '-');
          return await this.loadAgent(agentName);
        }
        
        // Handle other tools...
        
      } catch (error) {
        return this.formatError(error.message);
      }
    });
  }
  
  async start() {
    try {
      await this.initialize();
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('[AI-Context MCP] Server ready');
    } catch (error) {
      console.error('[AI-Context MCP] Failed to start:', error.message);
      process.exit(1);
    }
  }
}

// Start the server
const server = new AiContextMCPServer();
server.start().catch(console.error);
```

### Scanner Module (scanner.ts)

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { extractMetadata } from './metadata-extractor.js';

export class Scanner {
  constructor(private rootPath: string) {}
  
  async scanAgentsWithMetadata(): Promise<Map<string, AgentMetadata>> {
    const agentsDir = path.join(this.rootPath, 'agents');
    const agentsMap = new Map<string, AgentMetadata>();
    
    async function scan(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await scan(fullPath);
          } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            // Extract agent name from filename
            const agentName = entry.name.replace(/\.md$/i, '');
            
            // Read file and extract metadata using robust fallback system
            const content = await fs.readFile(fullPath, 'utf-8');
            const metadata = extractMetadata(content, 'agent');
            
            // Log extraction source for debugging
            if (metadata.source === 'fallback') {
              console.warn(`[Scanner] Using fallback extraction for ${agentName}`);
            }
            
            agentsMap.set(agentName, {
              name: agentName,
              path: fullPath,
              description: metadata.description,
              useCases: metadata.useCases || [],
              extractionSource: metadata.source
            });
          }
        }
      } catch (error) {
        // Directory might not exist
        console.warn(`[Scanner] Could not scan directory: ${dir}`);
      }
    }
    
    await scan(agentsDir);
    return agentsMap;
  }
  
  // Similar methods for scanGuidelinesWithMetadata and scanFrameworksWithMetadata
}
```

## Configuration Files

### Package.json (MCP Server Repository)

```json
{
  "name": "ai-context-mcp",
  "version": "1.0.0",
  "description": "MCP server for AI Context framework orchestration",
  "main": "dist/index.js",
  "bin": {
    "ai-context-mcp": "./dist/index.js"
  },
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest",
    "validate": "tsx src/validate.ts"
  },
  "keywords": [
    "mcp",
    "ai-context",
    "llm",
    "orchestration",
    "cursor",
    "claude"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/ai-context-mcp.git"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "vitest": "^1.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "license": "MIT"
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "lib": ["ES2022"],
    "moduleResolution": "node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

## GitHub Actions for Auto-Build

```yaml
# .github/workflows/build.yml
name: Build and Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm test
      - run: npm run build
      
      - name: Commit built files
        if: github.ref == 'refs/heads/main'
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add dist -f
          git diff --quiet && git diff --staged --quiet || git commit -m "Build dist [skip ci]"
          git push
```

## Client Configuration Examples

### Cursor (.cursor/mcp.json)
```json
{
  "mcpServers": {
    "ai-context": {
      "command": "npx",
      "args": ["github:your-org/ai-context-mcp"]
    }
  }
}
```

### Claude Desktop
```json
{
  "mcpServers": {
    "ai-context": {
      "command": "npx",
      "args": ["github:your-org/ai-context-mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### VS Code with Continue
```json
{
  "continue.mcpServers": [
    {
      "name": "ai-context",
      "command": "npx",
      "args": ["github:your-org/ai-context-mcp"]
    }
  ]
}
```

### With Custom .ai-context Path
```json
{
  "mcpServers": {
    "ai-context": {
      "command": "npx",
      "args": ["github:your-org/ai-context-mcp"],
      "env": {
        "AI_CONTEXT_ROOT": "./custom/path/.ai-context"
      }
    }
  }
}
```

### Using Specific Version/Branch
```json
{
  "mcpServers": {
    "ai-context": {
      "command": "npx",
      "args": ["github:your-org/ai-context-mcp#v1.0.0"]
    }
  }
}
```

## Metadata Validation Tool

```typescript
// src/validate.ts
import { extractMetadata } from './metadata-extractor.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function validateDirectory(dir: string) {
  const results = {
    valid: [],
    warnings: [],
    errors: []
  };
  
  async function scan(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.name.endsWith('.md')) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const type = currentDir.includes('agents') ? 'agent' : 
                       currentDir.includes('guidelines') ? 'guideline' : 'framework';
          const metadata = extractMetadata(content, type);
          
          const relativePath = path.relative(dir, fullPath);
          
          if (metadata.source === 'fallback') {
            results.warnings.push({
              file: relativePath,
              message: 'Using fallback extraction - consider adding structured metadata'
            });
          } else {
            results.valid.push({
              file: relativePath,
              source: metadata.source,
              description: metadata.description.substring(0, 50) + '...'
            });
          }
        } catch (error) {
          results.errors.push({
            file: path.relative(dir, fullPath),
            error: error.message
          });
        }
      }
    }
  }
  
  await scan(dir);
  return results;
}

// CLI usage
const contextRoot = process.argv[2] || '.ai-context';
const results = await validateDirectory(contextRoot);

console.log('\n✓ Valid files:', results.valid.length);
results.valid.forEach(v => console.log(`  ${v.file} (${v.source})`));

if (results.warnings.length > 0) {
  console.log('\n⚠ Warnings:', results.warnings.length);
  results.warnings.forEach(w => console.log(`  ${w.file}: ${w.message}`));
}

if (results.errors.length > 0) {
  console.log('\n✗ Errors:', results.errors.length);
  results.errors.forEach(e => console.log(`  ${e.file}: ${e.error}`));
}
```

## Deployment & Versioning

### Important: Dist Folder Requirement

For `npx github:...` to work, the compiled JavaScript (`dist/` folder) MUST be in the GitHub repository.

**Option 1: Commit dist folder**
```bash
# Remove dist from .gitignore
# Build and commit
npm run build
git add dist
git commit -m "Build dist"
git push
```

**Option 2: Use GitHub Actions (recommended)**
The GitHub Action automatically builds and commits the dist folder.

### Pushing to GitHub
```bash
# In the ai-context-mcp repository
npm run build
npm test

# Commit the dist folder (important for npx to work)
git add .
git commit -m "Release version 1.0.0"
git push origin main

# Create a GitHub release for version tracking
git tag v1.0.0
git push origin v1.0.0
```

## Benefits of This Architecture

1. **No Installation Required**: Users run directly from GitHub via npx
2. **Intelligent Agent Selection**: Each agent gets its own tool with rich metadata
3. **Multiple Metadata Formats**: Supports YAML, HTML comments, Markdown conventions, and natural language
4. **Graceful Degradation**: Always extracts something useful, even from plain text
5. **Backward Compatible**: Works with existing agent files
6. **Always Latest**: Automatically uses latest version from main branch
7. **Version Control**: Can pin to specific tags or branches
8. **Single Source of Truth**: One MCP server codebase for all projects
9. **Clean Separation**: MCP logic completely separate from content
10. **Automatic Tool Generation**: Add an agent file, get a tool automatically
11. **Fork-Friendly**: Easy to fork and customize for specific needs
12. **No Package Registry**: No NPM account or publishing process needed
13. **Debuggable**: Tracks which extraction method was used
14. **Scalable**: Supports unlimited agents without code changes

## Development Workflow

### For MCP Server Development
```bash
# Clone the MCP server repo
git clone https://github.com/your-org/ai-context-mcp.git
cd ai-context-mcp

# Install dependencies
npm install

# Development mode (with a test project)
AI_CONTEXT_ROOT=/path/to/test/project/.ai-context npm run dev

# Run tests
npm test

# Validate metadata extraction
npm run validate /path/to/test/project/.ai-context

# Build for production
npm run build

# Commit dist folder for npx compatibility
git add dist -f
git commit -m "Build dist"
git push
```

### Testing with Projects
```bash
# Test with local development version
cd my-project
node /path/to/ai-context-mcp/dist/index.js

# Or configure to use your fork for testing
{
  "mcpServers": {
    "ai-context": {
      "command": "npx",
      "args": ["github:your-fork/ai-context-mcp#your-branch"]
    }
  }
}
```

## Troubleshooting

### Server Can't Find .ai-context

Solution 1: Check working directory
```bash
# Make sure you're in the project directory
cd /path/to/your/project
```

Solution 2: Set explicit path
```json
{
  "mcpServers": {
    "ai-context": {
      "command": "npx",
      "args": ["github:your-org/ai-context-mcp"],
      "env": {
        "AI_CONTEXT_ROOT": "/absolute/path/to/.ai-context"
      }
    }
  }
}
```

### Debugging

The server logs to stderr (visible in MCP client logs):
```
[AI-Context MCP] Using .ai-context at: /path
[AI-Context MCP] Found: X agents, Y guidelines, Z frameworks
[AI-Context MCP] Server ready
[Scanner] Using fallback extraction for agent-name
```

### Clearing npx Cache

If you need to force a fresh download:
```bash
# Clear npx cache
rm -rf ~/.npm/_npx

# Or run with --ignore-existing
npx --ignore-existing github:your-org/ai-context-mcp
```

## License

MIT - See LICENSE file for details