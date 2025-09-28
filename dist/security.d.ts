/**
 * Security utility class for validating and restricting file system access
 * Ensures all file operations are restricted to the designated AI_CONTEXT_ROOT
 */
export declare class SecurityValidator {
    private readonly normalizedRoot;
    constructor(rootPath: string);
    /**
     * Validates a file path to ensure it's within the allowed boundary
     * @param requestedPath - The path to validate (can be relative or absolute)
     * @returns The validated absolute path
     * @throws Error if the path is outside the boundary or contains dangerous patterns
     */
    validatePath(requestedPath: string): string;
    /**
     * Checks if a path contains dangerous patterns that could lead to security issues
     */
    private containsDangerousPatterns;
    /**
     * Sanitizes a path for safe error message display
     * Removes any potentially sensitive information
     */
    private sanitizePath;
    /**
     * Validates that a file can be safely read
     * @param filePath - The path to validate
     * @returns true if the file can be read safely
     */
    isFileReadable(filePath: string): boolean;
    /**
     * Validates that a directory can be safely accessed
     * @param dirPath - The directory path to validate
     * @returns true if the directory can be accessed safely
     */
    isDirectoryAccessible(dirPath: string): boolean;
    /**
     * Safely reads a file with security validation
     * @param filePath - The file path to read
     * @returns The file contents as a string
     * @throws Error if the file cannot be read safely
     */
    safeReadFile(filePath: string): string;
    /**
     * Safely lists directory contents with security validation
     * @param dirPath - The directory path to list
     * @returns Array of file/directory names
     * @throws Error if the directory cannot be accessed safely
     */
    safeListDirectory(dirPath: string): string[];
    /**
     * Gets the root path for reference
     */
    getRootPath(): string;
}
export declare function initializeSecurity(rootPath: string): SecurityValidator;
export declare function getSecurity(): SecurityValidator;
//# sourceMappingURL=security.d.ts.map