export class Loader {
    agentsMetadata;
    guidelinesMetadata;
    frameworksMetadata;
    security;
    constructor(agentsMetadata, guidelinesMetadata, frameworksMetadata, security) {
        this.agentsMetadata = agentsMetadata;
        this.guidelinesMetadata = guidelinesMetadata;
        this.frameworksMetadata = frameworksMetadata;
        this.security = security;
    }
    async loadAgent(agentName) {
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
    async loadGuideline(guidelinePath) {
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
    async loadFramework(frameworkName) {
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
//# sourceMappingURL=loader.js.map