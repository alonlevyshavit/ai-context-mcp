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
    loader;
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
        // Initialize loader once
        this.loader = new Loader(this.rootPath, this.agentsMetadata, this.guidelinesMetadata, this.frameworksMetadata);
    }
    findAiContextRoot() {
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
        throw new Error('No .ai-context folder found. Please ensure you have a .ai-context folder ' +
            'in your project root or set AI_CONTEXT_ROOT environment variable.');
    }
    async initialize() {
        console.error(`${LogMessages.USING_AI_CONTEXT} ${this.rootPath}`);
        console.error(LogMessages.SCANNING_RESOURCES);
        const scanner = new Scanner(this.rootPath);
        // Scan all resources with metadata extraction
        this.agentsMetadata = await scanner.scanAgentsWithMetadata();
        this.guidelinesMetadata = await scanner.scanGuidelinesWithMetadata();
        this.frameworksMetadata = await scanner.scanFrameworksWithMetadata();
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
            // Create tool name from path (e.g., "development/api-design" -> "load_guideline_development_api_design")
            const toolName = `${ToolPrefixes.GUIDELINE}${guidelinePath.replace(/[\/\-]/g, '_')}`;
            // Add category and path info to metadata
            const description = `Category: ${metadata.category}\nPath: ${guidelinePath}\n\n${metadata.description}`;
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
                    const agentName = name.replace(ToolPrefixes.AGENT, '').replace(/_/g, '-');
                    return await this.loadAgent(agentName);
                }
                // Handle dynamic guideline loading tools
                if (name.startsWith(ToolPrefixes.GUIDELINE)) {
                    const guidelinePath = name.replace(ToolPrefixes.GUIDELINE, '').replace(/_/g, '/').replace('//', '-');
                    return await this.loadGuideline(guidelinePath);
                }
                // Handle dynamic framework loading tools
                if (name.startsWith(ToolPrefixes.FRAMEWORK)) {
                    const frameworkName = name.replace(ToolPrefixes.FRAMEWORK, '').replace(/_/g, '-');
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
        const metadata = this.agentsMetadata.get(agentName);
        if (!metadata) {
            const available = Array.from(this.agentsMetadata.keys()).join(', ');
            throw new Error(`Agent '${agentName}' not found. Available: ${available}`);
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