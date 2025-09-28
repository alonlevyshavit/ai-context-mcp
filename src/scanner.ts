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
import { SecurityValidator } from './security.js';

export class Scanner {
  constructor(
    _rootPath: string,
    private readonly security: SecurityValidator
  ) {}

  public async scanAgentsWithMetadata(): Promise<Map<string, AgentMetadata>> {
    const agentsRelativePath = DirectoryNames.AGENTS;
    const agentsMap = new Map<string, AgentMetadata>();

    const scan = async (relativePath: string): Promise<void> => {
      try {
        // Validate directory access using security validator
        if (!this.security.isDirectoryAccessible(relativePath)) {
          return;
        }

        const entries = this.security.safeListDirectory(relativePath);

        for (const entryName of entries) {
          const entryRelativePath = path.join(relativePath, entryName);

          // Check if it's a directory first
          if (this.security.isDirectoryAccessible(entryRelativePath)) {
            await scan(entryRelativePath);
          } else if (this.security.isFileReadable(entryRelativePath) &&
                     entryName.toLowerCase().endsWith(FileExtensions.MARKDOWN)) {
            // Extract agent name from filename
            const agentName = entryName.replace(new RegExp(`\\${FileExtensions.MARKDOWN}$`, 'i'), '');

            // Read file and extract metadata using security validator
            const content = this.security.safeReadFile(entryRelativePath);
            const extractedMetadata = extractMetadata(content);

            // Log extraction source for debugging
            if (extractedMetadata.source === 'paragraph') {
              console.error(`${LogMessages.USING_PARAGRAPH_EXTRACTION} ${agentName}`);
            }

            // Get the validated absolute path for storage
            const validatedPath = this.security.validatePath(entryRelativePath);

            const metadata: AgentMetadata = {
              name: agentName,
              path: validatedPath,
              description: extractedMetadata.content,
              metadataSource: extractedMetadata.source
            };

            agentsMap.set(agentName, metadata);
          }
        }
      } catch (error) {
        // Directory might not exist or access denied, silently continue
      }
    };

    await scan(agentsRelativePath);
    return agentsMap;
  }

  public async scanGuidelinesWithMetadata(): Promise<Map<string, GuidelineMetadata>> {
    const guidelinesRelativePath = DirectoryNames.GUIDELINES;
    const guidelinesMap = new Map<string, GuidelineMetadata>();

    const scan = async (currentRelativePath: string, baseRelativePath: string): Promise<void> => {
      try {
        // Validate directory access using security validator
        if (!this.security.isDirectoryAccessible(currentRelativePath)) {
          return;
        }

        const entries = this.security.safeListDirectory(currentRelativePath);

        for (const entryName of entries) {
          const entryRelativePath = path.join(currentRelativePath, entryName);

          // Check if it's a directory first
          if (this.security.isDirectoryAccessible(entryRelativePath)) {
            await scan(entryRelativePath, baseRelativePath);
          } else if (this.security.isFileReadable(entryRelativePath) &&
                     entryName.toLowerCase().endsWith(FileExtensions.MARKDOWN)) {
            const relativePath = path.relative(baseRelativePath, entryRelativePath);
            const key = relativePath.replace(/\\/g, '/').replace(new RegExp(`\\${FileExtensions.MARKDOWN}$`, 'i'), '');

            // Read file and extract metadata using security validator
            const content = this.security.safeReadFile(entryRelativePath);
            const extractedMetadata = extractMetadata(content);

            // Log extraction source for debugging
            if (extractedMetadata.source === 'paragraph') {
              console.error(`${LogMessages.USING_PARAGRAPH_EXTRACTION} guideline ${key}`);
            }

            // Extract category from path (e.g., "development/api-design" -> "development")
            const pathParts = key.split('/');
            const category = pathParts.length > 1 ? pathParts[0] : 'general';

            // Get the validated absolute path for storage
            const validatedPath = this.security.validatePath(entryRelativePath);

            const metadata: GuidelineMetadata = {
              name: key,
              path: validatedPath,
              category,
              description: extractedMetadata.content,
              metadataSource: extractedMetadata.source
            };

            guidelinesMap.set(key, metadata);
          }
        }
      } catch (error) {
        // Directory might not exist or access denied, silently continue
      }
    };

    await scan(guidelinesRelativePath, guidelinesRelativePath);
    return guidelinesMap;
  }

  public async scanFrameworksWithMetadata(): Promise<Map<string, FrameworkMetadata>> {
    const frameworksRelativePath = DirectoryNames.FRAMEWORKS;
    const frameworksMap = new Map<string, FrameworkMetadata>();

    try {
      // Validate directory access using security validator
      if (!this.security.isDirectoryAccessible(frameworksRelativePath)) {
        return frameworksMap;
      }

      const entries = this.security.safeListDirectory(frameworksRelativePath);

      for (const entryName of entries) {
        const frameworkRelativePath = path.join(frameworksRelativePath, entryName);

        if (this.security.isDirectoryAccessible(frameworkRelativePath)) {
          const readmeFiles = [`README${FileExtensions.MARKDOWN}`, `readme${FileExtensions.MARKDOWN}`, `Readme${FileExtensions.MARKDOWN}`];

          for (const readmeFile of readmeFiles) {
            const readmeRelativePath = path.join(frameworkRelativePath, readmeFile);

            if (this.security.isFileReadable(readmeRelativePath)) {
              try {
                // Read README and extract metadata using security validator
                const content = this.security.safeReadFile(readmeRelativePath);
                const extractedMetadata = extractMetadata(content);

                // Log extraction source for debugging
                if (extractedMetadata.source === 'paragraph') {
                  console.error(`${LogMessages.USING_PARAGRAPH_EXTRACTION} framework ${entryName}`);
                }

                // Get the validated absolute path for storage
                const validatedPath = this.security.validatePath(readmeRelativePath);

                const metadata: FrameworkMetadata = {
                  name: entryName,
                  path: validatedPath,
                  description: extractedMetadata.content,
                  metadataSource: extractedMetadata.source
                };

                frameworksMap.set(entryName, metadata);
                break;
              } catch {
                // Try next variant
              }
            }
          }
        }
      }
    } catch (error) {
      // Frameworks directory might not exist or access denied, silently continue
    }

    return frameworksMap;
  }
}