import { AgentMetadata, GuidelineMetadata, FrameworkMetadata } from './types.js';
import { SecurityValidator } from './security.js';

export class Loader {
  constructor(
    private readonly agentsMetadata: Map<string, AgentMetadata>,
    private readonly guidelinesMetadata: Map<string, GuidelineMetadata>,
    private readonly frameworksMetadata: Map<string, FrameworkMetadata>,
    private readonly security: SecurityValidator
  ) {}

  public async loadAgent(agentName: string): Promise<string> {
    const metadata = this.agentsMetadata.get(agentName);

    if (!metadata) {
      const available = Array.from(this.agentsMetadata.keys()).join(', ');
      throw new Error(`Agent '${agentName}' not found. Available: ${available}`);
    }

    // Use security validator to read file content
    // Convert absolute path to relative path for security validation
    const relativePath = metadata.path.startsWith(this.security.getRootPath())
      ? metadata.path.substring(this.security.getRootPath().length + 1)
      : metadata.path;

    return this.security.safeReadFile(relativePath);
  }

  public async loadGuideline(guidelinePath: string): Promise<string> {
    const metadata = this.guidelinesMetadata.get(guidelinePath);

    if (!metadata) {
      const available = Array.from(this.guidelinesMetadata.keys()).join(', ');
      throw new Error(`Guideline '${guidelinePath}' not found. Available: ${available}`);
    }

    // Use security validator to read file content
    // Convert absolute path to relative path for security validation
    const relativePath = metadata.path.startsWith(this.security.getRootPath())
      ? metadata.path.substring(this.security.getRootPath().length + 1)
      : metadata.path;

    return this.security.safeReadFile(relativePath);
  }

  public async loadFramework(frameworkName: string): Promise<string> {
    const metadata = this.frameworksMetadata.get(frameworkName);

    if (!metadata) {
      const available = Array.from(this.frameworksMetadata.keys()).join(', ');
      throw new Error(`Framework '${frameworkName}' not found. Available: ${available}`);
    }

    // Use security validator to read file content
    // Convert absolute path to relative path for security validation
    const relativePath = metadata.path.startsWith(this.security.getRootPath())
      ? metadata.path.substring(this.security.getRootPath().length + 1)
      : metadata.path;

    return this.security.safeReadFile(relativePath);
  }
}