/**
 * Configuration utilities for converting CLI flags to DesignSystemConfig
 */

import { join } from "path";
import { Framework, DesignLibrary, OutputMode } from "../models";
import type { DesignSystemConfig, DesignSystemGlobalFlags } from "../types";

/**
 * Convert CLI global flags to DesignSystemConfig
 * This function takes the flags (which may be populated from config file)
 * and converts them to the structured DesignSystemConfig format
 */
export const flagsToConfig = (flags: DesignSystemGlobalFlags): DesignSystemConfig => {
  // Parse stories pattern from comma-separated string
  const storiesPattern = flags.storiesPattern 
    ? flags.storiesPattern.split(',').map(p => p.trim())
    : ["**/*.stories.@(js|jsx|ts|tsx|mdx)"];

  return {
    name: flags.name || "My Design System",
    version: "1.0.0", // Hardcoded since version flag conflicts with yargs built-in
    description: flags.description || "Design system components for AI tools",
    rootDirectory: flags.rootDirectory || process.cwd(),
    baseImportPath: flags.baseImportPath,
    storybook: {
      storiesPattern,
      framework: (flags.framework as Framework) || Framework.REACT,
      parseDecorators: true,
      parseParameters: true,
    },
    designLibrary: (flags.designLibrary as DesignLibrary) || DesignLibrary.NONE,
    output: {
      mode: (flags.outputMode as OutputMode) || OutputMode.SINGLE_FILE,
      outputPath: flags.output || join(process.cwd(), "design-system-mcp.json"),
      format: "json",
      includeTheme: true,
      includeExamples: true,
      inlineFilePrefix: "",
      inlineFileExtension: ".dsm.json",
    },
  };
};

/**
 * Get default configuration values
 */
export const getDefaultConfig = (): DesignSystemConfig => {
  return flagsToConfig({});
};

/**
 * Load configuration (alias for flagsToConfig for backwards compatibility)
 */
export const loadConfig = flagsToConfig;


