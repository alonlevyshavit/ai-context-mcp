import * as fs from 'fs/promises';
import * as path from 'path';
import {
  AgentMetadata,
  GuidelineMetadata,
  FrameworkMetadata,
  DirectoryNames,
  FileExtensions,
  LogMessages
} from './types.js';
import { extractMetadata } from './metadata-extractor.js';

export class Scanner {
  constructor(private readonly rootPath: string) {}

  public async scanAgentsWithMetadata(): Promise<Map<string, AgentMetadata>> {
    const agentsDir = path.join(this.rootPath, DirectoryNames.AGENTS);
    const agentsMap = new Map<string, AgentMetadata>();

    const scan = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scan(fullPath);
          } else if (entry.isFile() && entry.name.toLowerCase().endsWith(FileExtensions.MARKDOWN)) {
            // Extract agent name from filename
            const agentName = entry.name.replace(new RegExp(`\\${FileExtensions.MARKDOWN}$`, 'i'), '');

            // Read file and extract metadata
            const content = await fs.readFile(fullPath, 'utf-8');
            const extractedMetadata = extractMetadata(content);

            // Log extraction source for debugging
            if (extractedMetadata.source === 'paragraph') {
              console.error(`${LogMessages.USING_PARAGRAPH_EXTRACTION} ${agentName}`);
            }

            const metadata: AgentMetadata = {
              name: agentName,
              path: fullPath,
              description: extractedMetadata.content,
              metadataSource: extractedMetadata.source
            };

            agentsMap.set(agentName, metadata);
          }
        }
      } catch (error) {
        // Directory might not exist, silently continue
      }
    };

    await scan(agentsDir);
    return agentsMap;
  }

  public async scanGuidelinesWithMetadata(): Promise<Map<string, GuidelineMetadata>> {
    const guidelinesDir = path.join(this.rootPath, DirectoryNames.GUIDELINES);
    const guidelinesMap = new Map<string, GuidelineMetadata>();

    const scan = async (dir: string, basePath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scan(fullPath, basePath);
          } else if (entry.isFile() && entry.name.toLowerCase().endsWith(FileExtensions.MARKDOWN)) {
            const relativePath = path.relative(basePath, fullPath);
            const key = relativePath.replace(/\\/g, '/').replace(new RegExp(`\\${FileExtensions.MARKDOWN}$`, 'i'), '');

            // Read file and extract metadata
            const content = await fs.readFile(fullPath, 'utf-8');
            const extractedMetadata = extractMetadata(content);

            // Log extraction source for debugging
            if (extractedMetadata.source === 'paragraph') {
              console.error(`${LogMessages.USING_PARAGRAPH_EXTRACTION} guideline ${key}`);
            }

            // Extract category from path (e.g., "development/api-design" -> "development")
            const pathParts = key.split('/');
            const category = pathParts.length > 1 ? pathParts[0] : 'general';

            const metadata: GuidelineMetadata = {
              name: key,
              path: fullPath,
              category,
              description: extractedMetadata.content,
              metadataSource: extractedMetadata.source
            };

            guidelinesMap.set(key, metadata);
          }
        }
      } catch (error) {
        // Directory might not exist, silently continue
      }
    };

    await scan(guidelinesDir, guidelinesDir);
    return guidelinesMap;
  }

  public async scanFrameworksWithMetadata(): Promise<Map<string, FrameworkMetadata>> {
    const frameworksDir = path.join(this.rootPath, DirectoryNames.FRAMEWORKS);
    const frameworksMap = new Map<string, FrameworkMetadata>();

    try {
      const entries = await fs.readdir(frameworksDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const frameworkPath = path.join(frameworksDir, entry.name);
          const readmeFiles = [`README${FileExtensions.MARKDOWN}`, `readme${FileExtensions.MARKDOWN}`, `Readme${FileExtensions.MARKDOWN}`];

          for (const readmeFile of readmeFiles) {
            const readmePath = path.join(frameworkPath, readmeFile);
            try {
              await fs.access(readmePath);

              // Read README and extract metadata
              const content = await fs.readFile(readmePath, 'utf-8');
              const extractedMetadata = extractMetadata(content);

              // Log extraction source for debugging
              if (extractedMetadata.source === 'paragraph') {
                console.error(`${LogMessages.USING_PARAGRAPH_EXTRACTION} framework ${entry.name}`);
              }

              const metadata: FrameworkMetadata = {
                name: entry.name,
                path: readmePath,
                description: extractedMetadata.content,
                metadataSource: extractedMetadata.source
              };

              frameworksMap.set(entry.name, metadata);
              break;
            } catch {
              // Try next variant
            }
          }
        }
      }
    } catch (error) {
      // Frameworks directory might not exist, silently continue
    }

    return frameworksMap;
  }
}