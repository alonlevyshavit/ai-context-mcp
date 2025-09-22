import * as fs from 'fs/promises';
import * as path from 'path';
export class Loader {
    rootPath;
    agentsMetadata;
    guidelinesMetadata;
    frameworksMetadata;
    constructor(rootPath, agentsMetadata, guidelinesMetadata, frameworksMetadata) {
        this.rootPath = rootPath;
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
        const content = await fs.readFile(metadata.path, 'utf-8');
        const parsed = this.parseAgentFile(content);
        const loadedContent = await this.loadReferencedContent(parsed);
        return this.assembleContext(parsed.persona, loadedContent);
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
    parseAgentFile(content) {
        const personaMatch = content.match(/^([\s\S]*?)(?=Read:)/);
        const persona = personaMatch ? personaMatch[1].trim() : content;
        const guidelines = [];
        const frameworks = [];
        const readPattern = /Read:\s*([^\n]+)/g;
        let match;
        while ((match = readPattern.exec(content)) !== null) {
            const path = match[1].trim();
            if (path.includes('/guidelines/')) {
                guidelines.push(path);
            }
            else if (path.includes('/frameworks/')) {
                frameworks.push(path);
            }
        }
        return { persona, guidelines, frameworks };
    }
    async loadReferencedContent(parsed) {
        const contents = [];
        // Load guidelines
        for (const guideline of parsed.guidelines) {
            try {
                const fullPath = path.join(this.rootPath, guideline.replace(/^\//, ''));
                const content = await fs.readFile(fullPath, 'utf-8');
                contents.push(`## Guideline: ${guideline}\n\n${content}`);
            }
            catch (error) {
                contents.push(`## Guideline: ${guideline}\n\n[Error: ${error.message}]`);
            }
        }
        // Load frameworks
        for (const framework of parsed.frameworks) {
            try {
                const frameworkName = framework.replace(/^\/frameworks\//, '').replace(/\/$/, '');
                const metadata = this.frameworksMetadata.get(frameworkName);
                if (metadata) {
                    const content = await fs.readFile(metadata.path, 'utf-8');
                    contents.push(`## Framework: ${framework}\n\n${content}`);
                }
                else {
                    contents.push(`## Framework: ${framework}\n\n[No README found]`);
                }
            }
            catch (error) {
                contents.push(`## Framework: ${framework}\n\n[Error: ${error.message}]`);
            }
        }
        return contents;
    }
    assembleContext(persona, loadedContent) {
        return [
            '# Agent Context Loaded',
            '',
            '## Agent Persona',
            persona,
            '',
            '## Loaded Guidelines and Frameworks',
            ...loadedContent
        ].join('\n');
    }
}
//# sourceMappingURL=loader.js.map