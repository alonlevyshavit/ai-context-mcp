# Changelog

## [1.1.0] - 2025-09-25

### Added
- **Discovery-based system instructions**: Added comprehensive instructions to server initialization that guide AI assistants to discover and use available resources rather than assuming specific agents exist
- **Debugger agent verification test**: Created comprehensive test to verify the debugger agent loads correctly with the actual `.ai-context` folder

### Changed
- **Improved tool naming**: Changed agent tool prefix from `load_agent_` to `load_` to eliminate redundancy (e.g., `load_agent_debugger_agent` → `load_debugger_agent`)
- **Simplified content loading**: All loaders (agents, guidelines, frameworks) now return exact file content without modification or assembly
- **Enhanced README**: Added discovery-first approach documentation and updated tool naming examples

### Fixed
- **Critical Loader initialization bug**: Fixed issue where Loader was initialized with empty metadata maps, causing "Agent not found" errors. Loader is now initialized after metadata population
- **Tool name collision**: Fixed issue where `load_multiple_resources` was incorrectly matched as an agent tool due to overlapping prefix patterns

### Security
- **Removed hardcoded paths**: Eliminated all hardcoded absolute paths from test files, using relative paths or environment variables instead

### Technical Details
- Tool prefix changed in `src/types.ts`: `AGENT = 'load_'` (previously `'load_agent_'`)
- Loader initialization moved from constructor to `initialize()` method in `src/index.ts`
- Removed `parseAgentFile()` and `assembleContext()` methods from `src/loader.ts`
- Added `SYSTEM_INSTRUCTIONS` constant with discovery-first guidance in `src/index.ts`
- Updated all tests to expect new tool naming convention

## [1.0.0] - Initial Release

### Features
- Dynamic tool generation from `.ai-context` folder structure
- Multi-format metadata extraction (YAML frontmatter, HTML comments, paragraph fallback)
- Support for agents, guidelines, and frameworks
- Static tools for listing and loading multiple resources
- Required `AI_CONTEXT_ROOT` environment variable for explicit configuration
- High test coverage (98%+) with comprehensive unit tests