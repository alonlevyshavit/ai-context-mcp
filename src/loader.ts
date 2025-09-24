import * as fs from 'fs/promises';
import { AgentMetadata, GuidelineMetadata, FrameworkMetadata } from './types.js';

export class Loader {
  constructor(
    private readonly agentsMetadata: Map<string, AgentMetadata>,
    private readonly guidelinesMetadata: Map<string, GuidelineMetadata>,
    private readonly frameworksMetadata: Map<string, FrameworkMetadata>
  ) {}

  public async loadAgent(agentName: string): Promise<string> {
    const metadata = this.agentsMetadata.get(agentName);

    if (!metadata) {
      const available = Array.from(this.agentsMetadata.keys()).join(', ');
      throw new Error(`Agent '${agentName}' not found. Available: ${available}`);
    }

    // Return raw file content, just like guidelines
    return fs.readFile(metadata.path, 'utf-8');
  }

  public async loadGuideline(guidelinePath: string): Promise<string> {
    const metadata = this.guidelinesMetadata.get(guidelinePath);

    if (!metadata) {
      const available = Array.from(this.guidelinesMetadata.keys()).join(', ');
      throw new Error(`Guideline '${guidelinePath}' not found. Available: ${available}`);
    }

    return fs.readFile(metadata.path, 'utf-8');
  }

  public async loadFramework(frameworkName: string): Promise<string> {
    const metadata = this.frameworksMetadata.get(frameworkName);

    if (!metadata) {
      const available = Array.from(this.frameworksMetadata.keys()).join(', ');
      throw new Error(`Framework '${frameworkName}' not found. Available: ${available}`);
    }

    return fs.readFile(metadata.path, 'utf-8');
  }
}