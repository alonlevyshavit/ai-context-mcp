import * as fs from 'fs';
import * as path from 'path';

/**
 * Security utility class for validating and restricting file system access
 * Ensures all file operations are restricted to the designated AI_CONTEXT_ROOT
 */
export class SecurityValidator {
  private readonly normalizedRoot: string;

  constructor(rootPath: string) {
    // Store the normalized root path
    this.normalizedRoot = path.resolve(rootPath);

    // Validate the root path exists and is a directory
    if (!fs.existsSync(this.normalizedRoot)) {
      throw new Error(`Security: Root path does not exist: ${rootPath}`);
    }

    const stats = fs.statSync(this.normalizedRoot);
    if (!stats.isDirectory()) {
      throw new Error(`Security: Root path is not a directory: ${rootPath}`);
    }
  }

  /**
   * Validates a file path to ensure it's within the allowed boundary
   * @param requestedPath - The path to validate (can be relative or absolute)
   * @returns The validated absolute path
   * @throws Error if the path is outside the boundary or contains dangerous patterns
   */
  validatePath(requestedPath: string): string {
    // Check for dangerous patterns before any processing
    if (this.containsDangerousPatterns(requestedPath)) {
      throw new Error(`Security: Path contains dangerous patterns: ${this.sanitizePath(requestedPath)}`);
    }

    // Resolve the path relative to root
    const resolved = path.resolve(this.normalizedRoot, requestedPath);
    const normalized = path.normalize(resolved);

    // Ensure the normalized path is within the root boundary
    if (!normalized.startsWith(this.normalizedRoot)) {
      throw new Error(`Security: Access denied - path outside boundary`);
    }

    // Additional check: ensure no symlinks are followed
    try {
      const realPath = fs.realpathSync(normalized);
      if (!realPath.startsWith(this.normalizedRoot)) {
        throw new Error(`Security: Symbolic link points outside boundary`);
      }
      return realPath;
    } catch (error) {
      // If file doesn't exist yet, just return the normalized path
      // This allows checking paths before they exist
      return normalized;
    }
  }

  /**
   * Checks if a path contains dangerous patterns that could lead to security issues
   */
  private containsDangerousPatterns(filePath: string): boolean {
    const dangerousPatterns = [
      /\.\./,           // Parent directory traversal
      /^~/,             // Home directory expansion
      /\$\{.*\}/,       // Variable expansion
      /\$\(.*\)/,       // Command substitution
      /%[0-9a-fA-F]{2}/, // URL encoded characters that might hide traversal
      /\\x[0-9a-fA-F]{2}/, // Hex encoded characters
      /\0/,             // Null bytes
    ];

    return dangerousPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Sanitizes a path for safe error message display
   * Removes any potentially sensitive information
   */
  private sanitizePath(filePath: string): string {
    // Only show the relative part if it's within bounds
    try {
      if (filePath.startsWith(this.normalizedRoot)) {
        return path.relative(this.normalizedRoot, filePath);
      }
    } catch {}

    // For paths outside bounds or with errors, just show generic message
    return '[sanitized]';
  }

  /**
   * Validates that a file can be safely read
   * @param filePath - The path to validate
   * @returns true if the file can be read safely
   */
  isFileReadable(filePath: string): boolean {
    try {
      const validated = this.validatePath(filePath);

      // Check if file exists
      if (!fs.existsSync(validated)) {
        return false;
      }

      const stats = fs.statSync(validated);

      // Only allow regular files (no directories, symlinks, devices, etc.)
      if (!stats.isFile()) {
        return false;
      }

      // Check read permission
      fs.accessSync(validated, fs.constants.R_OK);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates that a directory can be safely accessed
   * @param dirPath - The directory path to validate
   * @returns true if the directory can be accessed safely
   */
  isDirectoryAccessible(dirPath: string): boolean {
    try {
      const validated = this.validatePath(dirPath);

      // Check if directory exists
      if (!fs.existsSync(validated)) {
        return false;
      }

      const stats = fs.statSync(validated);

      // Must be a directory
      if (!stats.isDirectory()) {
        return false;
      }

      // Check read and execute permissions (needed to list directory)
      fs.accessSync(validated, fs.constants.R_OK | fs.constants.X_OK);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely reads a file with security validation
   * @param filePath - The file path to read
   * @returns The file contents as a string
   * @throws Error if the file cannot be read safely
   */
  safeReadFile(filePath: string): string {
    const validated = this.validatePath(filePath);

    if (!this.isFileReadable(validated)) {
      throw new Error(`Security: Cannot read file: ${this.sanitizePath(filePath)}`);
    }

    return fs.readFileSync(validated, 'utf-8');
  }

  /**
   * Safely lists directory contents with security validation
   * @param dirPath - The directory path to list
   * @returns Array of file/directory names
   * @throws Error if the directory cannot be accessed safely
   */
  safeListDirectory(dirPath: string): string[] {
    const validated = this.validatePath(dirPath);

    if (!this.isDirectoryAccessible(validated)) {
      throw new Error(`Security: Cannot access directory: ${this.sanitizePath(dirPath)}`);
    }

    return fs.readdirSync(validated);
  }

  /**
   * Gets the root path for reference
   */
  getRootPath(): string {
    return this.normalizedRoot;
  }
}

// Export a singleton instance for consistent security validation across the app
let securityValidator: SecurityValidator | null = null;

export function initializeSecurity(rootPath: string): SecurityValidator {
  if (!securityValidator) {
    securityValidator = new SecurityValidator(rootPath);
  }
  return securityValidator;
}

export function getSecurity(): SecurityValidator {
  if (!securityValidator) {
    throw new Error('Security: SecurityValidator not initialized');
  }
  return securityValidator;
}