/**
 * Main CLI entry point - imports and configures all commands
 */
import dotenv from 'dotenv';

dotenv.config({ path: '.dsmrc' });

import { EasyCLI, EasyCLITheme, EasyCLIConfigFile,EasyCLIInitCommand, EasyCLIConfigureCommand } from "easy-cli-framework";
import {
  scanCommand,
  parseCommand,
  listCommand,
  parseAICommand,
  generateCommand,
} from "./commands";
import type { DesignSystemGlobalFlags } from "./types";

// =============================================================================
// CLI SETUP
// =============================================================================

// Create configuration file manager
const config = new EasyCLIConfigFile({
  filename: 'dsm.config',
  extensions: ['json'],
});


// Create theme with verbose logging
const theme = new EasyCLITheme(3);

/**
 * Init command - creates initial configuration file
 */
export const initCommand = new EasyCLIInitCommand(config, 'init', {
  globalKeysToUse: ['output', 'name', 'description', 'rootDirectory', 'framework', 'designLibrary', 'outputMode', 'storiesPattern', 'baseImportPath'],
  promptGlobalKeys: ['output', 'name', 'description', 'rootDirectory', 'framework', 'designLibrary', 'outputMode', 'storiesPattern', 'baseImportPath'],
});

/**
 * Configure command - manage configuration file
 */
export const configureCommand = new EasyCLIConfigureCommand(config, 'configure', {
    globalKeysToUse: ['output', 'name', 'description', 'rootDirectory', 'framework', 'designLibrary', 'outputMode', 'storiesPattern', 'baseImportPath'],
  promptGlobalKeys: ['output', 'name', 'description', 'rootDirectory', 'framework', 'designLibrary', 'outputMode', 'storiesPattern', 'baseImportPath'],
});

// Create and configure CLI
const app = new EasyCLI<DesignSystemGlobalFlags>({
  executionName: "design-system-mcp",
  defaultCommand: "list",
  globalFlags: {
    verbose: {
      type: "boolean",
      describe: "Enable verbose logging",
      default: false,
    },
    output: {
      type: "string",
      describe: "Override output file path",
    },
    // Configuration flags that can be overridden by config file
    name: {
      type: "string",
      describe: "Design system name",
    },
    description: {
      type: "string",
      describe: "Design system description",
    },
    rootDirectory: {
      type: "string",
      describe: "Root directory to scan for stories",
    },
    framework: {
      type: "string",
      describe: "Frontend framework (react, vue, angular, svelte, web-components)",
      choices: ["react", "vue", "angular", "svelte", "web-components"],
    },
    designLibrary: {
      type: "string",
      describe: "Design library/system",
      choices: ["mui", "tailwind", "bootstrap", "chakra", "mantine", "antd", "semantic", "bulma", "foundation", "custom", "none"],
    },
    outputMode: {
      type: "string",
      describe: "Output mode (single-file or inline-files)",
      choices: ["single-file", "inline-files"],
      default: "inline-files",
    },
    storiesPattern: {
      type: "string",
      describe: "Glob pattern for story files (comma-separated for multiple patterns)",
      default: "**/*.stories.@(js|jsx|ts|tsx|mdx)",
    },
    baseImportPath: {
      type: "string",
      describe: "Base import path for components (e.g., '@examples', '@components')",
    },
  },
})
// Set the configuration file
app.setConfigFile(config);

// Configure and execute CLI
app
  .setTheme(theme)
  .addCommand(initCommand)
  .addCommand(configureCommand)
  .addCommand(scanCommand)
  .addCommand(parseCommand)
  .addCommand(listCommand)
  .addCommand(parseAICommand)
  .addCommand(generateCommand)
  .handleVerboseFlag()
  .execute();
