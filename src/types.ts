// Re-export types from models for convenience
export type {
  Framework,
  DesignLibrary,
  OutputMode,
  ComponentDefinition,
  DesignSystemConfig,
} from "./models";

// Global flags for the design system MCP tool
export type DesignSystemGlobalFlags = {
  verbose?: boolean;
  output?: string;
  // Configuration flags that can be overridden by config file
  name?: string;
  description?: string;
  rootDirectory?: string;
  framework?: string;
  designLibrary?: string;
  outputMode?: string;
  storiesPattern?: string;
  baseImportPath?: string;
};
