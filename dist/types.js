export var ToolPrefixes;
(function (ToolPrefixes) {
    ToolPrefixes["AGENT"] = "load_";
    ToolPrefixes["GUIDELINE"] = "load_guideline_";
    ToolPrefixes["FRAMEWORK"] = "load_framework_";
})(ToolPrefixes || (ToolPrefixes = {}));
export var StaticToolNames;
(function (StaticToolNames) {
    StaticToolNames["LIST_ALL_RESOURCES"] = "list_all_resources";
    StaticToolNames["LOAD_MULTIPLE_RESOURCES"] = "load_multiple_resources";
})(StaticToolNames || (StaticToolNames = {}));
export var DirectoryNames;
(function (DirectoryNames) {
    DirectoryNames["AGENTS"] = "agents";
    DirectoryNames["GUIDELINES"] = "guidelines";
    DirectoryNames["FRAMEWORKS"] = "frameworks";
})(DirectoryNames || (DirectoryNames = {}));
export var FileExtensions;
(function (FileExtensions) {
    FileExtensions["MARKDOWN"] = ".md";
})(FileExtensions || (FileExtensions = {}));
export var LogMessages;
(function (LogMessages) {
    LogMessages["USING_AI_CONTEXT"] = "[AI-Context MCP] Using .ai-context at:";
    LogMessages["SCANNING_RESOURCES"] = "[AI-Context MCP] Scanning for resources...";
    LogMessages["SERVER_READY"] = "[AI-Context MCP] Server ready";
    LogMessages["SAMPLE_TOOLS"] = "[AI-Context MCP] Sample of registered tools:";
    LogMessages["FOUND"] = "[AI-Context MCP] Found:";
    LogMessages["GENERATED_TOOLS"] = "[AI-Context MCP] Generated";
    LogMessages["FAILED_TO_START"] = "[AI-Context MCP] Failed to start:";
    LogMessages["USING_PARAGRAPH_EXTRACTION"] = "[Scanner] Using paragraph extraction for";
})(LogMessages || (LogMessages = {}));
//# sourceMappingURL=types.js.map