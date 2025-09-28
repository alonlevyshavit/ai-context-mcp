import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  realpathSync: vi.fn(),
  accessSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  constants: {
    R_OK: 4,
    X_OK: 1
  }
}));

// Import after mocking
const { SecurityValidator } = await import('./security.js');
import * as fs from 'fs';

describe('SecurityValidator', () => {
  let security: SecurityValidator;
  const testRootPath = '/test/ai-context';
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();

    // Mock root path validation
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);

    security = new SecurityValidator(testRootPath);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should throw error if root path does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => new SecurityValidator('/non/existent/path')).toThrow(
        'Security: Root path does not exist: /non/existent/path'
      );
    });

    it('should throw error if root path is not a directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);

      expect(() => new SecurityValidator('/test/file.txt')).toThrow(
        'Security: Root path is not a directory: /test/file.txt'
      );
    });

    it('should successfully initialize with valid directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);

      expect(() => new SecurityValidator(testRootPath)).not.toThrow();
    });
  });

  describe('validatePath - Path Traversal Protection', () => {
    it('should block parent directory traversal with ../', () => {
      expect(() => security.validatePath('../../../etc/passwd')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block parent directory traversal with ..\\', () => {
      expect(() => security.validatePath('..\\..\\windows\\system32')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block parent directory traversal in subdirectories', () => {
      expect(() => security.validatePath('agents/../../../etc/passwd')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block absolute paths starting with /', () => {
      expect(() => security.validatePath('/etc/passwd')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block home directory expansion with ~', () => {
      expect(() => security.validatePath('~/secrets')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block variable expansion patterns', () => {
      expect(() => security.validatePath('${HOME}/secrets')).toThrow(
        'Security: Path contains dangerous patterns'
      );

      expect(() => security.validatePath('$(cat /etc/passwd)')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block URL encoded traversal attempts', () => {
      expect(() => security.validatePath('%2e%2e%2f%2e%2e%2f')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block hex encoded traversal attempts', () => {
      expect(() => security.validatePath('\\x2e\\x2e\\x2f')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block null byte injection', () => {
      expect(() => security.validatePath('agents/test\0../../../etc/passwd')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });
  });

  describe('validatePath - Boundary Enforcement', () => {
    beforeEach(() => {
      // Mock path resolution
      vi.mocked(fs.realpathSync).mockImplementation((p) => p);
    });

    it('should allow valid paths within boundary', () => {
      const validPath = 'agents/test-agent.md';
      const result = security.validatePath(validPath);
      expect(result).toBe(path.resolve(testRootPath, validPath));
    });

    it('should allow nested valid paths', () => {
      const validPath = 'guidelines/development/api-design.md';
      const result = security.validatePath(validPath);
      expect(result).toBe(path.resolve(testRootPath, validPath));
    });

    it('should block paths that resolve outside boundary', () => {
      const maliciousPath = 'agents/../../outside-boundary.txt';

      // Mock realpathSync to return a path outside the boundary
      vi.mocked(fs.realpathSync).mockReturnValue('/outside/boundary/file.txt');

      expect(() => security.validatePath(maliciousPath)).toThrow(
        'Security: Symbolic link points outside boundary'
      );
    });

    it('should handle non-existent files gracefully', () => {
      vi.mocked(fs.realpathSync).mockImplementation(() => {
        throw new Error('File does not exist');
      });

      const validPath = 'agents/new-agent.md';
      const result = security.validatePath(validPath);
      expect(result).toBe(path.normalize(path.resolve(testRootPath, validPath)));
    });
  });

  describe('isFileReadable', () => {
    it('should return false for files outside boundary', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(security.isFileReadable('../../../etc/passwd')).toBe(false);
    });

    it('should return false for non-existent files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(security.isFileReadable('agents/non-existent.md')).toBe(false);
    });

    it('should return false for directories', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false } as any);
      expect(security.isFileReadable('agents')).toBe(false);
    });

    it('should return false for files without read permission', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
      vi.mocked(fs.accessSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      expect(security.isFileReadable('agents/restricted.md')).toBe(false);
    });

    it('should return true for readable files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
      vi.mocked(fs.accessSync).mockImplementation(() => {});
      expect(security.isFileReadable('agents/test.md')).toBe(true);
    });
  });

  describe('isDirectoryAccessible', () => {
    it('should return false for directories outside boundary', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(security.isDirectoryAccessible('../../../etc')).toBe(false);
    });

    it('should return false for non-existent directories', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(security.isDirectoryAccessible('non-existent')).toBe(false);
    });

    it('should return false for files (not directories)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
      expect(security.isDirectoryAccessible('agents/test.md')).toBe(false);
    });

    it('should return false for directories without read/execute permission', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(fs.accessSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      expect(security.isDirectoryAccessible('restricted-dir')).toBe(false);
    });

    it('should return true for accessible directories', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(fs.accessSync).mockImplementation(() => {});
      expect(security.isDirectoryAccessible('agents')).toBe(true);
    });
  });

  describe('safeReadFile', () => {
    it('should throw error for dangerous paths', () => {
      expect(() => security.safeReadFile('../../../etc/passwd')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should throw error for unreadable files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(() => security.safeReadFile('agents/non-existent.md')).toThrow(
        'Security: Cannot read file'
      );
    });

    it('should successfully read valid files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
      vi.mocked(fs.accessSync).mockImplementation(() => {});
      vi.mocked(fs.readFileSync).mockReturnValue('file content');

      const result = security.safeReadFile('agents/test.md');
      expect(result).toBe('file content');
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith(
        path.resolve(testRootPath, 'agents/test.md'),
        'utf-8'
      );
    });
  });

  describe('safeListDirectory', () => {
    it('should throw error for dangerous paths', () => {
      expect(() => security.safeListDirectory('../../../etc')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should throw error for inaccessible directories', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(() => security.safeListDirectory('non-existent')).toThrow(
        'Security: Cannot access directory'
      );
    });

    it('should successfully list valid directories', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(fs.accessSync).mockImplementation(() => {});
      vi.mocked(fs.readdirSync).mockReturnValue(['file1.md', 'file2.md', 'subdir'] as any);

      const result = security.safeListDirectory('agents');
      expect(result).toEqual(['file1.md', 'file2.md', 'subdir']);
      expect(vi.mocked(fs.readdirSync)).toHaveBeenCalledWith(
        path.resolve(testRootPath, 'agents')
      );
    });
  });

  describe('Edge Cases and Complex Attacks', () => {
    it('should block mixed encoding attacks', () => {
      expect(() => security.validatePath('agents/%2e%2e/../../etc/passwd')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block unicode normalization attacks', () => {
      // Test various unicode dot representations
      expect(() => security.validatePath('agents/\u002e\u002e/secrets')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block long path attacks', () => {
      const longPath = '../'.repeat(100) + 'etc/passwd';
      expect(() => security.validatePath(longPath)).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });

    it('should block symlink attacks', () => {
      vi.mocked(fs.realpathSync).mockReturnValue('/etc/passwd');

      expect(() => security.validatePath('agents/link-to-passwd')).toThrow(
        'Security: Symbolic link points outside boundary'
      );
    });

    it('should handle Windows-style paths', () => {
      expect(() => security.validatePath('agents\\..\\..\\windows\\system32')).toThrow(
        'Security: Path contains dangerous patterns'
      );
    });
  });

  describe('Error Message Sanitization', () => {
    it('should sanitize error messages to not expose system paths', () => {
      try {
        security.validatePath('../../../etc/passwd');
      } catch (error) {
        expect(error.message).toContain('[sanitized]');
        expect(error.message).not.toContain('/etc/passwd');
        expect(error.message).not.toContain(testRootPath);
      }
    });

    it('should show relative paths for files within boundary', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      try {
        security.safeReadFile('agents/test.md');
      } catch (error) {
        expect((error as Error).message).toContain('agents/test.md');
        expect((error as Error).message).not.toContain(testRootPath);
      }
    });
  });

  describe('getRootPath', () => {
    it('should return the normalized root path', () => {
      expect(security.getRootPath()).toBe(path.resolve(testRootPath));
    });
  });
});

// Integration tests with actual file system operations
describe('SecurityValidator Integration Tests', () => {
  let tempDir: string;
  let security: SecurityValidator;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = `/tmp/security-test-${Date.now()}`;

    // Mock the temp directory creation for the test
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return path === tempDir;
    });

    vi.mocked(fs.statSync).mockImplementation(() => ({
      isDirectory: () => true
    } as any));

    security = new SecurityValidator(tempDir);
  });

  it('should prevent access to parent directories', () => {
    expect(() => security.validatePath('../outside-root')).toThrow();
  });

  it('should allow access to files within root', () => {
    // Mock file existence
    vi.mocked(fs.realpathSync).mockReturnValue(`${tempDir}/allowed-file.txt`);

    const result = security.validatePath('allowed-file.txt');
    expect(result.startsWith(tempDir)).toBe(true);
  });
});