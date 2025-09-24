export interface ResourceMetadata {
  name: string;
  path: string;
  description: string;  // Raw metadata content (YAML, HTML, or first paragraph)
  metadataSource: 'yaml' | 'html' | 'paragraph';
}

export type AgentMetadata = ResourceMetadata;
export type GuidelineMetadata = ResourceMetadata & { category: string };
export type FrameworkMetadata = ResourceMetadata;

export interface DynamicTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export enum ToolPrefixes {
  AGENT = 'load_',
  GUIDELINE = 'load_guideline_',
  FRAMEWORK = 'load_framework_'
}

export enum StaticToolNames {
  LIST_ALL_RESOURCES = 'list_all_resources',
  LOAD_MULTIPLE_RESOURCES = 'load_multiple_resources'
}

export enum DirectoryNames {
  AGENTS = 'agents',
  GUIDELINES = 'guidelines',
  FRAMEWORKS = 'frameworks'
}

export enum FileExtensions {
  MARKDOWN = '.md'
}

export enum LogMessages {
  USING_AI_CONTEXT = '[AI-Context MCP] Using .ai-context at:',
  SCANNING_RESOURCES = '[AI-Context MCP] Scanning for resources...',
  SERVER_READY = '[AI-Context MCP] Server ready',
  SAMPLE_TOOLS = '[AI-Context MCP] Sample of registered tools:',
  FOUND = '[AI-Context MCP] Found:',
  GENERATED_TOOLS = '[AI-Context MCP] Generated',
  FAILED_TO_START = '[AI-Context MCP] Failed to start:',
  USING_PARAGRAPH_EXTRACTION = '[Scanner] Using paragraph extraction for'
}