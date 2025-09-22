# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a **standalone MCP (Model Context Protocol) server** that provides AI context orchestration for any project with a `.ai-context` folder. The server runs independently and can be used by multiple projects without installation via `npx github:org/ai-context-mcp`.

### Core Architecture Pattern

The system follows a **dynamic tool generation** pattern where each discovered agent/guideline/framework automatically becomes an MCP tool:

```
.ai-context/agents/planner.md → load_agent_planner tool
.ai-context/guidelines/api-design.md → load_guideline_api_design tool
.ai-context/frameworks/memory/README.md → load_framework_memory tool
```

### Key Components

1. **AiContextMCPServer** (`src/index.ts`) - Main server class that:
   - Auto-discovers `.ai-context` folders using path resolution strategy
   - Initializes single instances of Scanner and Loader (performance optimization)
   - Generates dynamic MCP tools based on discovered resources
   - Handles MCP protocol communication

2. **Scanner** (`src/scanner.ts`) - Resource discovery system that:
   - Recursively scans agents/, guidelines/, frameworks/ directories
   - Extracts metadata from each resource file using simplified approach
   - Returns Maps of metadata for dynamic tool generation

3. **Loader** (`src/loader.ts`) - Content loading system that:
   - Loads individual agent/guideline/framework content
   - Assembles complex contexts from multiple resources
   - Handles referenced guideline/framework loading

4. **MetadataExtractor** (`src/metadata-extractor.ts`) - Multi-format metadata extraction:
   - YAML frontmatter (preferred)
   - HTML comment metadata
   - First paragraph fallback
   - **Simplified approach**: passes raw metadata content to LLM tools

### Enum-Based Constants System

All strings are defined as enums in `src/types.ts` for maintainability:
- `ToolPrefixes` - load_agent_, load_guideline_, load_framework_
- `StaticToolNames` - list_all_resources, load_multiple_resources
- `DirectoryNames` - agents, guidelines, frameworks
- `FileExtensions` - .md
- `LogMessages` - All console output messages

## Commands

### Development Commands
- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Run in development mode with a specific .ai-context folder: `AI_CONTEXT_ROOT=/path/to/.ai-context npm run dev`
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:coverage` - Run tests with coverage report
- `npm run typecheck` - Run TypeScript type checking without emitting files
- `npm run validate` - Validate metadata extraction for a given .ai-context folder

### Testing Specific Components
- `npm test -- scanner.test.ts` - Run only scanner tests
- `npm test -- index.test.ts` - Run only main server logic tests
- `npm test -- metadata-extractor.test.ts` - Run only metadata extraction tests

### Path Resolution Strategy

The server finds `.ai-context` folders in this priority order:
1. `AI_CONTEXT_ROOT` environment variable (absolute path)
2. Current working directory + `/.ai-context`
3. Walk up directory tree looking for `.ai-context`
4. Error if not found

### Tool Generation Logic

**Dynamic Tools**: Each discovered resource becomes a specific tool
```typescript
// agents/planner.md → load_agent_planner
// guidelines/dev/api-design.md → load_guideline_dev_api_design
// frameworks/memory → load_framework_memory
```

**Static Tools**: Always available regardless of content
- `list_all_resources` - Lists all discovered resources
- `load_multiple_resources` - Loads multiple resources simultaneously

### Single Instance Pattern

The server uses a **single Loader instance** created in the constructor rather than creating new instances per request. This improves performance and memory usage.

## Important Implementation Notes

### Metadata Extraction Simplification

The system **passes raw metadata content directly to LLM tools** rather than parsing it into structured objects. This allows the LLM to interpret YAML, HTML comments, or natural text as needed.

### Error Handling Strategy

- Scanner methods silently continue on missing directories (agents/guidelines/frameworks may not all exist)
- File read errors are caught and logged but don't crash the server
- Missing .ai-context folder throws a clear error with setup instructions

### Tool Name Transformations

```typescript
// Agent: "my-agent" → "load_agent_my_agent"
agentName.replace(/-/g, '_')

// Guideline: "dev/api-design" → "load_guideline_dev_api_design"
guidelinePath.replace(/[\\/\\-]/g, '_')

// Framework: "structured-memory" → "load_framework_structured_memory"
frameworkName.replace(/-/g, '_')
```

### Path Parsing Logic

When tools are called, paths are reconstructed:
```typescript
// load_agent_my_agent → "my-agent"
name.replace(ToolPrefixes.AGENT, '').replace(/_/g, '-')

// load_guideline_dev_api_design → "dev/api/design"
name.replace(ToolPrefixes.GUIDELINE, '').replace(/_/g, '/').replace('//', '-')
```

## Development Workflow

### Running Tests
Always run the full test suite before committing:
```bash
npm run test:run
npm run typecheck
```

### Local Development with Test Project
```bash
# Point to a test .ai-context folder
AI_CONTEXT_ROOT=/path/to/test-project/.ai-context npm run dev
```

### Adding New Functionality
1. Add any new string constants to appropriate enums in `src/types.ts`
2. Write comprehensive unit tests with mocking
3. Ensure all tools use enum constants rather than hardcoded strings
4. Run coverage to ensure high test coverage

### Testing Architecture

- **Comprehensive mocking strategy** for all file system and external dependencies
- **Logic-focused testing** that avoids server instantiation side effects
- **High coverage** (98%+ for core components)
- Tests are organized by component with dedicated test files

### Common Issues
- **Server instantiation in tests**: Avoid importing `src/index.ts` in tests as it immediately starts the server
- **Path separators**: Handle both Unix (`/`) and Windows (`\`) path separators in guideline parsing
- **Case sensitivity**: File extension matching uses case-insensitive comparison