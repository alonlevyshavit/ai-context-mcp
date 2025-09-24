#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Scanner } from './scanner.js';
import { Loader } from './loader.js';
import { ToolPrefixes, StaticToolNames, LogMessages } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
class AiContextMCPServer {
    server;
    rootPath;
    agentsMetadata = new Map();
    guidelinesMetadata = new Map();
    frameworksMetadata = new Map();
    dynamicTools = [];
    loader; // Will be initialized after metadata is loaded
    guidelineToolMapping = new Map(); // Maps tool name to full path
    agentToolMapping = new Map(); // Maps tool name to agent name
    frameworkToolMapping = new Map(); // Maps tool name to framework name
    constructor() {
        this.rootPath = this.findAiContextRoot();
        this.server = new Server({
            name: 'ai-context-mcp',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        // Loader will be initialized after metadata is populated
    }
    findAiContextRoot() {
        // AI_CONTEXT_ROOT environment variable is required
        if (!process.env.AI_CONTEXT_ROOT) {
            throw new Error('AI_CONTEXT_ROOT environment variable is required.\n\n' +
                'Please set AI_CONTEXT_ROOT to the absolute path of your .ai-context folder.\n' +
                'Example configuration in Cursor (.cursor/mcp.json):\n' +
                '{\n' +
                '  "mcpServers": {\n' +
                '    "ai-context": {\n' +
                '      "command": "npx",\n' +
                '      "args": ["--yes", "github:alonlevyshavit/ai-context-mcp"],\n' +
                '      "env": {\n' +
                '        "AI_CONTEXT_ROOT": "/absolute/path/to/your/project/.ai-context"\n' +
                '      }\n' +
                '    }\n' +
                '  }\n' +
                '}');
        }
        const explicitPath = path.resolve(process.env.AI_CONTEXT_ROOT);
        if (!fs.existsSync(explicitPath)) {
            throw new Error(`AI_CONTEXT_ROOT was set to '${process.env.AI_CONTEXT_ROOT}' but path does not exist.\n` +
                `Please check the path and ensure the .ai-context folder exists.`);
        }
        console.error(`[AI-Context MCP] Using AI_CONTEXT_ROOT: ${explicitPath}`);
        return explicitPath;
    }
    async initialize() {
        console.error(`${LogMessages.USING_AI_CONTEXT} ${this.rootPath}`);
        console.error(LogMessages.SCANNING_RESOURCES);
        const scanner = new Scanner(this.rootPath);
        // Scan all resources with metadata extraction
        this.agentsMetadata = await scanner.scanAgentsWithMetadata();
        this.guidelinesMetadata = await scanner.scanGuidelinesWithMetadata();
        this.frameworksMetadata = await scanner.scanFrameworksWithMetadata();
        // Initialize loader AFTER metadata is populated
        this.loader = new Loader(this.rootPath, this.agentsMetadata, this.guidelinesMetadata, this.frameworksMetadata);
        // Generate dynamic tools for each resource
        this.generateDynamicTools();
        console.error(`${LogMessages.FOUND}`);
        console.error(`  - ${this.agentsMetadata.size} agents`);
        console.error(`  - ${this.guidelinesMetadata.size} guidelines`);
        console.error(`  - ${this.frameworksMetadata.size} frameworks`);
        console.error(`${LogMessages.GENERATED_TOOLS} ${this.dynamicTools.length} tools total`);
        this.setupHandlers();
    }
    generateDynamicTools() {
        // Generate tools for agents
        for (const [agentName, metadata] of this.agentsMetadata) {
            const toolName = `${ToolPrefixes.AGENT}${agentName.replace(/-/g, '_')}`;
            // Store the mapping from tool name to actual agent name
            this.agentToolMapping.set(toolName, agentName);
            // Use the raw metadata as the tool description
            const description = metadata.description;
            this.dynamicTools.push({
                name: toolName,
                description,
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            });
        }
        // Generate tools for guidelines
        for (const [guidelinePath, metadata] of this.guidelinesMetadata) {
            // Create shorter tool name by using only the last part of the path
            // e.g., "testing/e2e/playwright_agent_guidelines" -> "load_guideline_playwright_agent"
            const pathParts = guidelinePath.split('/');
            const lastName = pathParts[pathParts.length - 1]
                .replace(/_guidelines?$/, '') // Remove "_guidelines" or "_guideline" suffix
                .replace(/[_-]guideline?s?$/, ''); // Also remove "-guidelines", "-guideline", etc.
            // If we still have a very long name, use the last two meaningful parts
            let shortName = lastName;
            if (lastName.length > 20 && pathParts.length > 1) {
                // Take the parent folder name as well for context
                const parentName = pathParts[pathParts.length - 2];
                shortName = `${parentName}_${lastName}`.substring(0, 30);
            }
            const toolName = `${ToolPrefixes.GUIDELINE}${shortName.replace(/[\/\-]/g, '_')}`;
            // Store the mapping from tool name to full path
            this.guidelineToolMapping.set(toolName, guidelinePath);
            // Add category and full path info to metadata for clarity
            const description = `Category: ${metadata.category}\nFull Path: ${guidelinePath}\n\n${metadata.description}`;
            this.dynamicTools.push({
                name: toolName,
                description,
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            });
        }
        // Generate tools for frameworks
        for (const [frameworkName, metadata] of this.frameworksMetadata) {
            const toolName = `${ToolPrefixes.FRAMEWORK}${frameworkName.replace(/-/g, '_')}`;
            // Store the mapping from tool name to actual framework name
            this.frameworkToolMapping.set(toolName, frameworkName);
            // Use the raw metadata as the tool description
            const description = metadata.description;
            this.dynamicTools.push({
                name: toolName,
                description,
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            });
        }
    }
    setupHandlers() {
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
                if (name.startsWith(ToolPrefixes.AGENT)) {
                    // Debug logging
                    console.error(`[DEBUG] Tool called: '${name}'`);
                    console.error(`[DEBUG] Tool mapping entries: ${Array.from(this.agentToolMapping.entries()).map(([k, v]) => `${k}=${v}`).join(', ')}`);
                    // Use the mapping to get the actual agent name
                    const agentName = this.agentToolMapping.get(name);
                    if (!agentName) {
                        throw new Error(`Agent tool '${name}' not found in mapping. Available mappings: ${Array.from(this.agentToolMapping.keys()).join(', ')}`);
                    }
                    return await this.loadAgent(agentName);
                }
                // Handle dynamic guideline loading tools
                if (name.startsWith(ToolPrefixes.GUIDELINE)) {
                    // Use the mapping to get the full path
                    const fullPath = this.guidelineToolMapping.get(name);
                    if (!fullPath) {
                        throw new Error(`Guideline tool '${name}' not found in mapping`);
                    }
                    return await this.loadGuideline(fullPath);
                }
                // Handle dynamic framework loading tools
                if (name.startsWith(ToolPrefixes.FRAMEWORK)) {
                    // Use the mapping to get the actual framework name
                    const frameworkName = this.frameworkToolMapping.get(name);
                    if (!frameworkName) {
                        throw new Error(`Framework tool '${name}' not found in mapping`);
                    }
                    return await this.loadFramework(frameworkName);
                }
                // Handle static tools
                switch (name) {
                    case StaticToolNames.LIST_ALL_RESOURCES:
                        return this.listAllResources();
                    case StaticToolNames.LOAD_MULTIPLE_RESOURCES:
                        return await this.loadMultipleResources(args?.resources || []);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                return this.formatError(error.message);
            }
        });
    }
    getStaticTools() {
        return [
            {
                name: StaticToolNames.LIST_ALL_RESOURCES,
                description: "Lists all available agents, guidelines, and frameworks in the system with their metadata",
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            },
            {
                name: StaticToolNames.LOAD_MULTIPLE_RESOURCES,
                description: `Load multiple resources (agents, guidelines, or frameworks) simultaneously for complex tasks.

        Specify resources with prefixes:
        - agent: for agents (e.g., "agent:planner")
        - guideline: for guidelines (e.g., "guideline:development/api-design")
        - framework: for frameworks (e.g., "framework:structured-memory")

        Example: ["agent:planner", "agent:codebase", "guideline:testing/unit-testing"]`,
                inputSchema: {
                    type: "object",
                    properties: {
                        resources: {
                            type: "array",
                            items: { type: "string" },
                            description: "List of resources with type prefixes"
                        }
                    },
                    required: ["resources"]
                }
            }
        ];
    }
    async loadAgent(agentName) {
        // Debug logging
        console.error(`[DEBUG] Looking for agent: '${agentName}'`);
        console.error(`[DEBUG] Current AI_CONTEXT_ROOT: ${this.rootPath}`);
        console.error(`[DEBUG] Number of agents loaded: ${this.agentsMetadata.size}`);
        console.error(`[DEBUG] Available agents: ${Array.from(this.agentsMetadata.keys()).join(', ')}`);
        const metadata = this.agentsMetadata.get(agentName);
        if (!metadata) {
            const available = Array.from(this.agentsMetadata.keys());
            if (available.length === 0) {
                throw new Error(`Agent '${agentName}' not found. No agents are loaded. ` +
                    `Please check that AI_CONTEXT_ROOT (${this.rootPath}) contains an 'agents' directory with .md files.`);
            }
            throw new Error(`Agent '${agentName}' not found. Available agents: ${available.join(', ')}`);
        }
        const content = await this.loader.loadAgent(agentName);
        return this.formatResponse(content);
    }
    async loadGuideline(guidelinePath) {
        const content = await this.loader.loadGuideline(guidelinePath);
        return this.formatResponse(content);
    }
    async loadFramework(frameworkName) {
        const content = await this.loader.loadFramework(frameworkName);
        return this.formatResponse(content);
    }
    async loadMultipleResources(resources) {
        const contexts = [];
        for (const resource of resources) {
            try {
                const [type, name] = resource.split(':');
                let content = '';
                switch (type) {
                    case 'agent':
                        content = await this.loader.loadAgent(name);
                        contexts.push(`## Agent: ${name}\n\n${content}`);
                        break;
                    case 'guideline':
                        content = await this.loader.loadGuideline(name);
                        contexts.push(`## Guideline: ${name}\n\n${content}`);
                        break;
                    case 'framework':
                        content = await this.loader.loadFramework(name);
                        contexts.push(`## Framework: ${name}\n\n${content}`);
                        break;
                    default:
                        contexts.push(`## Unknown resource type: ${resource}`);
                }
            }
            catch (error) {
                contexts.push(`## Error loading ${resource}: ${error.message}`);
            }
        }
        return this.formatResponse(contexts.join('\n\n---\n\n'));
    }
    listAllResources() {
        const resources = {
            agents: Array.from(this.agentsMetadata.entries()).map(([name, meta]) => ({
                name,
                metadata: meta.description.substring(0, 100) + '...',
                source: meta.metadataSource
            })),
            guidelines: Array.from(this.guidelinesMetadata.entries()).map(([path, meta]) => ({
                path,
                category: meta.category,
                metadata: meta.description.substring(0, 100) + '...',
                source: meta.metadataSource
            })),
            frameworks: Array.from(this.frameworksMetadata.entries()).map(([name, meta]) => ({
                name,
                metadata: meta.description.substring(0, 100) + '...',
                source: meta.metadataSource
            }))
        };
        return this.formatResponse(JSON.stringify(resources, null, 2));
    }
    formatResponse(data) {
        return {
            content: [{
                    type: 'text',
                    text: data
                }]
        };
    }
    formatError(message) {
        return {
            content: [{
                    type: 'text',
                    text: `Error: ${message}`
                }]
        };
    }
    async start() {
        try {
            await this.initialize();
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            console.error(LogMessages.SERVER_READY);
            console.error(LogMessages.SAMPLE_TOOLS);
            // Show first few of each type
            const agentTools = this.dynamicTools.filter(t => t.name.startsWith(ToolPrefixes.AGENT)).slice(0, 3);
            const guidelineTools = this.dynamicTools.filter(t => t.name.startsWith(ToolPrefixes.GUIDELINE)).slice(0, 3);
            const frameworkTools = this.dynamicTools.filter(t => t.name.startsWith(ToolPrefixes.FRAMEWORK)).slice(0, 3);
            [...agentTools, ...guidelineTools, ...frameworkTools].forEach(tool => {
                console.error(`  - ${tool.name}`);
            });
            if (this.dynamicTools.length > 9) {
                console.error(`  ... and ${this.dynamicTools.length - 9} more tools`);
            }
        }
        catch (error) {
            console.error(`${LogMessages.FAILED_TO_START}`, error.message);
            process.exit(1);
        }
    }
}
// Start the server
const server = new AiContextMCPServer();
server.start().catch(console.error);
//# sourceMappingURL=index.js.map