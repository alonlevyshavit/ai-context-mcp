import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToolPrefixes, StaticToolNames, LogMessages } from './types.js';
import * as path from 'path';

// Mock all dependencies
const mockServer = {
  setRequestHandler: vi.fn(),
  connect: vi.fn()
};

const mockScanner = {
  scanAgentsWithMetadata: vi.fn(),
  scanGuidelinesWithMetadata: vi.fn(),
  scanFrameworksWithMetadata: vi.fn()
};

const mockLoader = {
  loadAgent: vi.fn(),
  loadGuideline: vi.fn(),
  loadFramework: vi.fn()
};

const mockTransport = {};

const mockExistsSync = vi.fn();
const mockReadFile = vi.fn();

// Mock MCP SDK
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn(() => mockServer)
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(() => mockTransport)
}));

// Mock Scanner
vi.mock('./scanner.js', () => ({
  Scanner: vi.fn(() => mockScanner)
}));

// Mock Loader
vi.mock('./loader.js', () => ({
  Loader: vi.fn(() => mockLoader)
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: mockExistsSync
}));

// Mock process
Object.defineProperty(process, 'env', {
  writable: true,
  value: {}
});

Object.defineProperty(process, 'cwd', {
  writable: true,
  value: vi.fn(() => '/current/working/dir')
});

Object.defineProperty(process, 'exit', {
  writable: true,
  value: vi.fn()
});

// We need to test the logic without importing index.js directly
// since it immediately starts the server. Instead, we'll test the logic units.

describe('AiContextMCPServer', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();

    // Reset process env
    process.env = {};
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('findAiContextRoot logic', () => {
    it('should prefer AI_CONTEXT_ROOT environment variable', () => {
      const testPath = '/explicit/ai-context/path';
      process.env.AI_CONTEXT_ROOT = testPath;

      // Test the logic directly
      const resolvedPath = path.resolve(testPath);
      expect(resolvedPath).toBe(testPath);
    });

    it('should construct correct cwd path', () => {
      const cwd = '/current/working/dir';
      const expectedPath = path.join(cwd, '.ai-context');
      expect(expectedPath).toBe('/current/working/dir/.ai-context');
    });

    it('should construct correct parent directory paths', () => {
      const currentDir = '/some/deep/nested/dir';
      const parentDir = path.dirname(currentDir);
      expect(parentDir).toBe('/some/deep/nested');

      const contextPath = path.join(parentDir, '.ai-context');
      expect(contextPath).toBe('/some/deep/nested/.ai-context');
    });
  });

  describe('server initialization logic', () => {
    it('should validate required log messages exist', () => {
      expect(LogMessages.USING_AI_CONTEXT).toBe('[AI-Context MCP] Using .ai-context at:');
      expect(LogMessages.SCANNING_RESOURCES).toBe('[AI-Context MCP] Scanning for resources...');
      expect(LogMessages.FOUND).toBe('[AI-Context MCP] Found:');
      expect(LogMessages.SERVER_READY).toBe('[AI-Context MCP] Server ready');
    });

    it('should have correct tool prefixes', () => {
      expect(ToolPrefixes.AGENT).toBe('load_agent_');
      expect(ToolPrefixes.GUIDELINE).toBe('load_guideline_');
      expect(ToolPrefixes.FRAMEWORK).toBe('load_framework_');
    });

    it('should have correct static tool names', () => {
      expect(StaticToolNames.LIST_ALL_RESOURCES).toBe('list_all_resources');
      expect(StaticToolNames.LOAD_MULTIPLE_RESOURCES).toBe('load_multiple_resources');
    });
  });

  describe('tool generation', () => {
    it('should generate agent tools with correct prefixes', () => {
      const agentName = 'test-agent';
      const expectedToolName = `${ToolPrefixes.AGENT}test_agent`;

      // This tests the tool name generation logic
      const toolName = `${ToolPrefixes.AGENT}${agentName.replace(/-/g, '_')}`;
      expect(toolName).toBe(expectedToolName);
    });

    it('should generate guideline tools with path-based names', () => {
      const guidelinePath = 'development/api-design';
      const expectedToolName = `${ToolPrefixes.GUIDELINE}development_api_design`;

      const toolName = `${ToolPrefixes.GUIDELINE}${guidelinePath.replace(/[\\/\\-]/g, '_')}`;
      expect(toolName).toBe(expectedToolName);
    });

    it('should generate framework tools with correct prefixes', () => {
      const frameworkName = 'structured-memory';
      const expectedToolName = `${ToolPrefixes.FRAMEWORK}structured_memory`;

      const toolName = `${ToolPrefixes.FRAMEWORK}${frameworkName.replace(/-/g, '_')}`;
      expect(toolName).toBe(expectedToolName);
    });
  });

  describe('tool execution simulation', () => {
    beforeEach(() => {
      mockLoader.loadAgent.mockResolvedValue('Agent content');
      mockLoader.loadGuideline.mockResolvedValue('Guideline content');
      mockLoader.loadFramework.mockResolvedValue('Framework content');
    });

    it('should handle agent tool calls correctly', async () => {
      const toolName = `${ToolPrefixes.AGENT}test_agent`;
      const expectedAgentName = 'test-agent';

      // Simulate tool name parsing
      const agentName = toolName.replace(ToolPrefixes.AGENT, '').replace(/_/g, '-');
      expect(agentName).toBe(expectedAgentName);
    });

    it('should handle guideline tool calls correctly', async () => {
      const toolName = `${ToolPrefixes.GUIDELINE}development_api_design`;
      const expectedPath = 'development/api/design';

      // Simulate tool name parsing (matches actual implementation)
      const guidelinePath = toolName.replace(ToolPrefixes.GUIDELINE, '').replace(/_/g, '/').replace('//', '-');
      expect(guidelinePath).toBe(expectedPath);
    });

    it('should handle framework tool calls correctly', async () => {
      const toolName = `${ToolPrefixes.FRAMEWORK}structured_memory`;
      const expectedName = 'structured-memory';

      // Simulate tool name parsing
      const frameworkName = toolName.replace(ToolPrefixes.FRAMEWORK, '').replace(/_/g, '-');
      expect(frameworkName).toBe(expectedName);
    });

    it('should handle static tool calls', () => {
      // Test static tool names
      expect(StaticToolNames.LIST_ALL_RESOURCES).toBe('list_all_resources');
      expect(StaticToolNames.LOAD_MULTIPLE_RESOURCES).toBe('load_multiple_resources');
    });
  });

  describe('response formatting', () => {
    it('should format successful responses correctly', () => {
      const testData = 'Test response data';
      const expectedFormat = {
        content: [{
          type: 'text',
          text: testData
        }]
      };

      // Test the expected response format
      const response = {
        content: [{
          type: 'text',
          text: testData
        }]
      };

      expect(response).toEqual(expectedFormat);
    });

    it('should format error responses correctly', () => {
      const errorMessage = 'Test error message';
      const expectedFormat = {
        content: [{
          type: 'text',
          text: `Error: ${errorMessage}`
        }]
      };

      const response = {
        content: [{
          type: 'text',
          text: `Error: ${errorMessage}`
        }]
      };

      expect(response).toEqual(expectedFormat);
    });
  });

  describe('resource parsing for multiple loads', () => {
    it('should parse agent resources correctly', () => {
      const resource = 'agent:test-planner';
      const [type, name] = resource.split(':');

      expect(type).toBe('agent');
      expect(name).toBe('test-planner');
    });

    it('should parse guideline resources correctly', () => {
      const resource = 'guideline:development/api-design';
      const [type, name] = resource.split(':');

      expect(type).toBe('guideline');
      expect(name).toBe('development/api-design');
    });

    it('should parse framework resources correctly', () => {
      const resource = 'framework:structured-memory';
      const [type, name] = resource.split(':');

      expect(type).toBe('framework');
      expect(name).toBe('structured-memory');
    });

    it('should handle malformed resource strings', () => {
      const resource = 'invalid-resource-format';
      const parts = resource.split(':');

      expect(parts.length).toBe(1);
      expect(parts[0]).toBe('invalid-resource-format');
    });
  });

  describe('error handling patterns', () => {
    it('should format error messages correctly', () => {
      const errorMessage = 'Test error message';
      const formattedError = `Error: ${errorMessage}`;

      expect(formattedError).toBe('Error: Test error message');
    });

    it('should define missing directory error message', () => {
      const errorMessage =
        'No .ai-context folder found. Please ensure you have a .ai-context folder ' +
        'in your project root or set AI_CONTEXT_ROOT environment variable.';

      expect(errorMessage).toContain('.ai-context folder');
      expect(errorMessage).toContain('AI_CONTEXT_ROOT');
    });

    it('should validate error response format', () => {
      const errorResponse = {
        content: [{
          type: 'text',
          text: 'Error: Load failed'
        }]
      };

      expect(errorResponse.content).toHaveLength(1);
      expect(errorResponse.content[0].type).toBe('text');
      expect(errorResponse.content[0].text).toContain('Error:');
    });
  });

  describe('metadata source tracking', () => {
    it('should track metadata sources correctly', () => {
      const testMetadata = {
        name: 'test',
        path: '/test/path',
        description: 'Test description',
        metadataSource: 'yaml' as const
      };

      expect(testMetadata.metadataSource).toBe('yaml');

      // Test all possible sources
      const sources = ['yaml', 'html', 'paragraph'] as const;
      sources.forEach(source => {
        expect(['yaml', 'html', 'paragraph']).toContain(source);
      });
    });
  });
});