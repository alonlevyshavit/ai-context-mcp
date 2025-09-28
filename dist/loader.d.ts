import { AgentMetadata, GuidelineMetadata, FrameworkMetadata } from './types.js';
import { SecurityValidator } from './security.js';
export declare class Loader {
    private readonly agentsMetadata;
    private readonly guidelinesMetadata;
    private readonly frameworksMetadata;
    private readonly security;
    constructor(agentsMetadata: Map<string, AgentMetadata>, guidelinesMetadata: Map<string, GuidelineMetadata>, frameworksMetadata: Map<string, FrameworkMetadata>, security: SecurityValidator);
    loadAgent(agentName: string): Promise<string>;
    loadGuideline(guidelinePath: string): Promise<string>;
    loadFramework(frameworkName: string): Promise<string>;
}
//# sourceMappingURL=loader.d.ts.map