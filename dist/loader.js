import * as fs from 'fs/promises';
export class Loader {
    agentsMetadata;
    guidelinesMetadata;
    frameworksMetadata;
    constructor(agentsMetadata, guidelinesMetadata, frameworksMetadata) {
        this.agentsMetadata = agentsMetadata;
        this.guidelinesMetadata = guidelinesMetadata;
        this.frameworksMetadata = frameworksMetadata;
    }
    async loadAgent(agentName) {
        const metadata = this.agentsMetadata.get(agentName);
        if (!metadata) {
            const available = Array.from(this.agentsMetadata.keys()).join(', ');
            throw new Error(`Agent '${agentName}' not found. Available: ${available}`);
        }
        // Return raw file content, just like guidelines
        return fs.readFile(metadata.path, 'utf-8');
    }
    async loadGuideline(guidelinePath) {
        const metadata = this.guidelinesMetadata.get(guidelinePath);
        if (!metadata) {
            const available = Array.from(this.guidelinesMetadata.keys()).join(', ');
            throw new Error(`Guideline '${guidelinePath}' not found. Available: ${available}`);
        }
        return fs.readFile(metadata.path, 'utf-8');
    }
    async loadFramework(frameworkName) {
        const metadata = this.frameworksMetadata.get(frameworkName);
        if (!metadata) {
            const available = Array.from(this.frameworksMetadata.keys()).join(', ');
            throw new Error(`Framework '${frameworkName}' not found. Available: ${available}`);
        }
        return fs.readFile(metadata.path, 'utf-8');
    }
}
//# sourceMappingURL=loader.js.map