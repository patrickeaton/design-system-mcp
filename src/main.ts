/**
 * Main CLI entry point - imports and configures all commands
 */
import dotenv from 'dotenv';

dotenv.config({ path: '.dsmrc' });

import {
  EasyCLI,
  EasyCLITheme,
  EasyCLIConfigFile,
  EasyCLIInitCommand,
  EasyCLIConfigureCommand,
} from 'easy-cli-framework';
import {
  scanCommand,
  parseCommand,
  listCommand,
  generateCommand,
} from './commands';
import { 
  registerAllParsers, 
  parserConfigRegistry,
  transformConfigWithParsers,
  saveConfigTransformer,
  loadConfigTransformer
} from './utils/parser-config-registry';
import type { DesignSystemGlobalFlags } from './types';

// =============================================================================
// CLI SETUP
// =============================================================================

/**
 * Initialize CLI with dynamic parser configuration
 */
async function initializeCLI() {
  // Register all parsers and get their config keys
  const parserGlobalFlags = await registerAllParsers();
  const parserFlagSchemas = parserConfigRegistry.getGlobalFlagSchemas();

  // Create configuration file manager with transformation
  const config = new EasyCLIConfigFile({
    filename: 'dsm.config',
    extensions: ['json'],
    saveTransformer: saveConfigTransformer,
    loadTransformer: loadConfigTransformer,
  });

  // Create theme with verbose logging
  const theme = new EasyCLITheme(3);

  // Base global keys
  const baseGlobalKeys = [
    'output',
    'name',
    'description',
    'rootDirectory',
    'framework',
    'designLibrary',
    'outputMode',
    'storiesPattern',
    'baseImportPath',
    'parsers',
  ];

  // Add parser-specific global keys
  const allGlobalKeys = [...baseGlobalKeys, ...parserGlobalFlags];

  /**
   * Init command - creates initial configuration file
   */
  const initCommand = new EasyCLIInitCommand(config, 'init', {
    globalKeysToUse: allGlobalKeys,
    promptGlobalKeys: allGlobalKeys,
  });

  /**
   * Configure command - manage configuration file
   */
  const configureCommand = new EasyCLIConfigureCommand(config, 'configure', {
    globalKeysToUse: allGlobalKeys,
    promptGlobalKeys: allGlobalKeys,
  });

  // Build global flags with parser-specific flags
  const globalFlags: any = {
    verbose: {
      type: 'boolean',
      describe: 'Enable verbose logging',
      default: false,
    },
    output: {
      type: 'string',
      describe: 'Override output file path',
    },
    // Configuration flags that can be overridden by config file
    name: {
      type: 'string',
      describe: 'Design system name',
    },
    description: {
      type: 'string',
      describe: 'Design system description',
    },
    rootDirectory: {
      type: 'string',
      describe: 'Root directory to scan for stories',
    },
    framework: {
      type: 'string',
      describe:
        'Frontend framework (react, vue, angular, svelte, web-components)',
      choices: ['react', 'vue', 'angular', 'svelte', 'web-components'],
    },
    designLibrary: {
      type: 'string',
      describe: 'Design library/system',
      choices: [
        'mui',
        'tailwind',
        'bootstrap',
        'chakra',
        'mantine',
        'antd',
        'semantic',
        'bulma',
        'foundation',
        'custom',
        'none',
      ],
    },
    outputMode: {
      type: 'string',
      describe: 'Output mode (single-file or inline-files)',
      choices: ['single-file', 'inline-files'],
      default: 'inline-files',
    },
    storiesPattern: {
      type: 'string',
      describe:
        'Glob pattern for story files (comma-separated for multiple patterns)',
      default: '**/*.stories.@(js|jsx|ts|tsx|mdx)',
    },
    baseImportPath: {
      type: 'string',
      describe:
        "Base import path for components (e.g., '@examples', '@components')",
    },
    parsers: {
      type: 'string',
      describe: 'Enable or disable specific parsers in the parser chain',
      choices: ['storybook', 'openai', 'comments'],
      default: ['comments'],
      array: true,
    },
    // Add parser-specific flags
    ...parserFlagSchemas,
  };

  // Create and configure CLI
  const app = new EasyCLI<DesignSystemGlobalFlags>({
    executionName: 'design-system-mcp',
    defaultCommand: 'list',
    globalFlags,
  });

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
    .addCommand(generateCommand)
    .handleVerboseFlag()
    .execute();

  return app;
}

// Initialize and run CLI
initializeCLI().catch((error) => {
  console.error('Failed to initialize CLI:', error);
  throw error;
});
