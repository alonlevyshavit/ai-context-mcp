import { AgentMetadata, GuidelineMetadata, FrameworkMetadata } from './types.js';
export declare class Scanner {
    private readonly rootPath;
    constructor(rootPath: string);
    scanAgentsWithMetadata(): Promise<Map<string, AgentMetadata>>;
    scanGuidelinesWithMetadata(): Promise<Map<string, GuidelineMetadata>>;
    scanFrameworksWithMetadata(): Promise<Map<string, FrameworkMetadata>>;
}
//# sourceMappingURL=scanner.d.ts.map