import { AgentMetadata, GuidelineMetadata, FrameworkMetadata } from './types.js';
import { SecurityValidator } from './security.js';
export declare class Scanner {
    private readonly security;
    constructor(_rootPath: string, security: SecurityValidator);
    scanAgentsWithMetadata(): Promise<Map<string, AgentMetadata>>;
    scanGuidelinesWithMetadata(): Promise<Map<string, GuidelineMetadata>>;
    scanFrameworksWithMetadata(): Promise<Map<string, FrameworkMetadata>>;
}
//# sourceMappingURL=scanner.d.ts.map