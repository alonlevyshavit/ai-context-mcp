import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DirectoryNames, FileExtensions, LogMessages } from './types.js';
import * as path from 'path';

// Mock fs and metadata extractor
const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
const mockAccess = vi.fn();
const mockExtractMetadata = vi.fn();

// Mock SecurityValidator
const mockSecurityValidator = {
  isDirectoryAccessible: vi.fn(),
  isFileReadable: vi.fn(),
  safeListDirectory: vi.fn(),
  safeReadFile: vi.fn(),
  validatePath: vi.fn(),
  getRootPath: vi.fn()
};

vi.mock('fs/promises', () => ({
  readdir: mockReaddir,
  readFile: mockReadFile,
  access: mockAccess
}));

vi.mock('./metadata-extractor.js', () => ({
  extractMetadata: mockExtractMetadata
}));

vi.mock('./security.js', () => ({
  SecurityValidator: vi.fn().mockImplementation(() => mockSecurityValidator)
}));

// Import after mocking
const { Scanner } = await import('./scanner.js');

describe('Scanner', () => {
  let scanner: InstanceType<typeof Scanner>;
  const testRootPath = '/test/root';
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default security validator behavior
    mockSecurityValidator.isDirectoryAccessible.mockReturnValue(true);
    mockSecurityValidator.isFileReadable.mockReturnValue(true);
    mockSecurityValidator.safeListDirectory.mockReturnValue([]);
    mockSecurityValidator.safeReadFile.mockReturnValue('test content');
    mockSecurityValidator.validatePath.mockImplementation((p) => path.resolve(testRootPath, p));
    mockSecurityValidator.getRootPath.mockReturnValue(testRootPath);

    scanner = new Scanner(testRootPath, mockSecurityValidator as any);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('scanAgentsWithMetadata', () => {
    it('should scan agents directory and return metadata map', async () => {
      // Setup security validator mocks
      mockSecurityValidator.isDirectoryAccessible.mockReturnValue(true);
      mockSecurityValidator.safeListDirectory.mockReturnValue(['agent1.md', 'agent2.md', 'not-md.txt']);
      mockSecurityValidator.isFileReadable.mockImplementation((path) => path.endsWith('.md'));
      mockSecurityValidator.safeReadFile.mockReturnValue('test content');
      mockSecurityValidator.validatePath.mockImplementation((p) => path.resolve(testRootPath, p));

      mockExtractMetadata.mockReturnValue({
        content: 'Test agent description',
        source: 'yaml'
      });

      const result = await scanner.scanAgentsWithMetadata();

      expect(mockSecurityValidator.safeListDirectory).toHaveBeenCalledWith(DirectoryNames.AGENTS);
      expect(result.size).toBe(2);
      expect(result.get('agent1')).toEqual({
        name: 'agent1',
        path: path.resolve(testRootPath, DirectoryNames.AGENTS, 'agent1.md'),
        description: 'Test agent description',
        metadataSource: 'yaml'
      });
    });

    it('should handle nested directories recursively', async () => {
      // Setup security validator mocks for recursive scanning
      mockSecurityValidator.isDirectoryAccessible.mockImplementation((path) => {
        return path === DirectoryNames.AGENTS || path.includes('subdir');
      });
      mockSecurityValidator.safeListDirectory.mockImplementation((path) => {
        if (path === DirectoryNames.AGENTS) {
          return ['subdir'];
        } else if (path.includes('subdir')) {
          return ['nested-agent.md'];
        }
        return [];
      });
      mockSecurityValidator.isFileReadable.mockImplementation((path) => path.endsWith('.md'));
      mockSecurityValidator.safeReadFile.mockReturnValue('nested content');
      mockSecurityValidator.validatePath.mockImplementation((p) => path.resolve(testRootPath, p));

      mockExtractMetadata.mockReturnValue({
        content: 'Nested agent description',
        source: 'html'
      });

      const result = await scanner.scanAgentsWithMetadata();

      expect(result.size).toBe(1);
      expect(result.get('nested-agent')).toEqual({
        name: 'nested-agent',
        path: path.resolve(testRootPath, DirectoryNames.AGENTS, 'subdir', 'nested-agent.md'),
        description: 'Nested agent description',
        metadataSource: 'html'
      });
    });

    it('should log warning when using paragraph extraction', async () => {
      const mockEntries = [
        { name: 'agent.md', isDirectory: () => false, isFile: () => true }
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockReadFile.mockResolvedValue('content');
      mockExtractMetadata.mockReturnValue({
        content: 'Paragraph description',
        source: 'paragraph'
      });

      await scanner.scanAgentsWithMetadata();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `${LogMessages.USING_PARAGRAPH_EXTRACTION} agent`
      );
    });

    it('should handle missing agents directory gracefully', async () => {
      mockReaddir.mockRejectedValue(new Error('Directory not found'));

      const result = await scanner.scanAgentsWithMetadata();

      expect(result.size).toBe(0);
    });

    it('should only process markdown files', async () => {
      const mockEntries = [
        { name: 'agent1.md', isDirectory: () => false, isFile: () => true },
        { name: 'agent2.MD', isDirectory: () => false, isFile: () => true },
        { name: 'not-markdown.txt', isDirectory: () => false, isFile: () => true },
        { name: 'README.rst', isDirectory: () => false, isFile: () => true }
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockReadFile.mockResolvedValue('content');
      mockExtractMetadata.mockReturnValue({
        content: 'Description',
        source: 'yaml'
      });

      const result = await scanner.scanAgentsWithMetadata();

      expect(result.size).toBe(2); // Both .md and .MD files (case insensitive check)
      expect(mockReadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('scanGuidelinesWithMetadata', () => {
    it('should scan guidelines directory and return metadata map with categories', async () => {
      const mockEntries = [
        { name: 'development', isDirectory: () => true, isFile: () => false },
        { name: 'general.md', isDirectory: () => false, isFile: () => true }
      ];
      const mockSubEntries = [
        { name: 'api-design.md', isDirectory: () => false, isFile: () => true }
      ];

      mockReaddir
        .mockResolvedValueOnce(mockEntries)
        .mockResolvedValueOnce(mockSubEntries);
      mockReadFile.mockResolvedValue('guideline content');
      mockExtractMetadata.mockReturnValue({
        content: 'Guideline description',
        source: 'yaml'
      });

      const result = await scanner.scanGuidelinesWithMetadata();

      expect(result.size).toBe(2);

      const devGuideline = result.get('development/api-design');
      expect(devGuideline).toEqual({
        name: 'development/api-design',
        path: path.join(testRootPath, DirectoryNames.GUIDELINES, 'development', 'api-design.md'),
        category: 'development',
        description: 'Guideline description',
        metadataSource: 'yaml'
      });

      const generalGuideline = result.get('general');
      expect(generalGuideline?.category).toBe('general');
    });

    it('should log warning for paragraph extraction in guidelines', async () => {
      const mockEntries = [
        { name: 'guide.md', isDirectory: () => false, isFile: () => true }
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockReadFile.mockResolvedValue('content');
      mockExtractMetadata.mockReturnValue({
        content: 'Paragraph description',
        source: 'paragraph'
      });

      await scanner.scanGuidelinesWithMetadata();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `${LogMessages.USING_PARAGRAPH_EXTRACTION} guideline guide`
      );
    });
  });

  describe('scanFrameworksWithMetadata', () => {
    it('should scan frameworks directory and find README files', async () => {
      const mockEntries = [
        { name: 'framework1', isDirectory: () => true, isFile: () => false },
        { name: 'framework2', isDirectory: () => true, isFile: () => false },
        { name: 'not-a-framework.txt', isDirectory: () => false, isFile: () => true }
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockAccess
        .mockRejectedValueOnce(new Error('Not found')) // README.md
        .mockResolvedValueOnce(undefined) // readme.md
        .mockRejectedValueOnce(new Error('Not found')) // README.md
        .mockRejectedValueOnce(new Error('Not found')) // readme.md
        .mockResolvedValueOnce(undefined); // Readme.md

      mockReadFile.mockResolvedValue('framework content');
      mockExtractMetadata.mockReturnValue({
        content: 'Framework description',
        source: 'html'
      });

      const result = await scanner.scanFrameworksWithMetadata();

      expect(result.size).toBe(2);

      const framework1 = result.get('framework1');
      expect(framework1).toEqual({
        name: 'framework1',
        path: path.join(testRootPath, DirectoryNames.FRAMEWORKS, 'framework1', 'readme.md'),
        description: 'Framework description',
        metadataSource: 'html'
      });
    });

    it('should try all README file variants in order', async () => {
      const mockEntries = [
        { name: 'framework', isDirectory: () => true, isFile: () => false }
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockAccess
        .mockRejectedValueOnce(new Error('Not found')) // README.md
        .mockRejectedValueOnce(new Error('Not found')) // readme.md
        .mockResolvedValueOnce(undefined); // Readme.md

      mockReadFile.mockResolvedValue('content');
      mockExtractMetadata.mockReturnValue({
        content: 'Description',
        source: 'yaml'
      });

      await scanner.scanFrameworksWithMetadata();

      expect(mockAccess).toHaveBeenCalledTimes(3);
      expect(mockAccess).toHaveBeenNthCalledWith(1,
        path.join(testRootPath, DirectoryNames.FRAMEWORKS, 'framework', `README${FileExtensions.MARKDOWN}`)
      );
      expect(mockAccess).toHaveBeenNthCalledWith(2,
        path.join(testRootPath, DirectoryNames.FRAMEWORKS, 'framework', `readme${FileExtensions.MARKDOWN}`)
      );
      expect(mockAccess).toHaveBeenNthCalledWith(3,
        path.join(testRootPath, DirectoryNames.FRAMEWORKS, 'framework', `Readme${FileExtensions.MARKDOWN}`)
      );
    });

    it('should skip frameworks without README files', async () => {
      const mockEntries = [
        { name: 'framework-no-readme', isDirectory: () => true, isFile: () => false }
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockAccess.mockRejectedValue(new Error('Not found'));

      const result = await scanner.scanFrameworksWithMetadata();

      expect(result.size).toBe(0);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('should handle missing frameworks directory gracefully', async () => {
      mockReaddir.mockRejectedValue(new Error('Directory not found'));

      const result = await scanner.scanFrameworksWithMetadata();

      expect(result.size).toBe(0);
    });

    it('should log warning for paragraph extraction in frameworks', async () => {
      const mockEntries = [
        { name: 'framework', isDirectory: () => true, isFile: () => false }
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('content');
      mockExtractMetadata.mockReturnValue({
        content: 'Paragraph description',
        source: 'paragraph'
      });

      await scanner.scanFrameworksWithMetadata();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `${LogMessages.USING_PARAGRAPH_EXTRACTION} framework framework`
      );
    });

    it('should only process directory entries as frameworks', async () => {
      const mockEntries = [
        { name: 'valid-framework', isDirectory: () => true, isFile: () => false },
        { name: 'file.md', isDirectory: () => false, isFile: () => true },
        { name: 'another-file.txt', isDirectory: () => false, isFile: () => true }
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('content');
      mockExtractMetadata.mockReturnValue({
        content: 'Description',
        source: 'yaml'
      });

      const result = await scanner.scanFrameworksWithMetadata();

      expect(result.size).toBe(1);
      expect(result.has('valid-framework')).toBe(true);
      expect(mockAccess).toHaveBeenCalledTimes(1); // Only called for valid-framework
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      const mockEntries = [
        { name: 'agent.md', isDirectory: () => false, isFile: () => true }
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      // Should not throw, but should handle error gracefully
      const result = await scanner.scanAgentsWithMetadata();
      expect(result.size).toBe(0); // No agents added due to read error
    });

    it('should handle metadata extraction errors gracefully', async () => {
      const mockEntries = [
        { name: 'agent.md', isDirectory: () => false, isFile: () => true }
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockReadFile.mockResolvedValue('content');
      mockExtractMetadata.mockImplementation(() => {
        throw new Error('Extraction failed');
      });

      // Should not throw, but should handle error gracefully
      const result = await scanner.scanAgentsWithMetadata();
      expect(result.size).toBe(0); // No agents added due to extraction error
    });
  });
});