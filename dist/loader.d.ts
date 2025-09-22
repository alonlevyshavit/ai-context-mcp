import { AgentMetadata, GuidelineMetadata, FrameworkMetadata } from './types.js';
export declare class Loader {
    private readonly rootPath;
    private readonly agentsMetadata;
    private readonly guidelinesMetadata;
    private readonly frameworksMetadata;
    constructor(rootPath: string, agentsMetadata: Map<string, AgentMetadata>, guidelinesMetadata: Map<string, GuidelineMetadata>, frameworksMetadata: Map<string, FrameworkMetadata>);
    loadAgent(agentName: string): Promise<string>;
    loadGuideline(guidelinePath: string): Promise<string>;
    loadFramework(frameworkName: string): Promise<string>;
    private parseAgentFile;
    private loadReferencedContent;
    private assembleContext;
}
//# sourceMappingURL=loader.d.ts.map