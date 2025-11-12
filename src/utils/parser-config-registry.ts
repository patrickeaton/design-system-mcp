/**
 * Parser configuration registry and transformer
 * Allows parsers to register global config keys that get transformed
 * into parser-specific configuration sections
 */

import { ComponentParser } from '../parsers/parser-interface';

export interface ParserConfigRegistration {
  parserName: string;
  configKey: string;
  schema: any;
  globalFlag: string; // The global CLI flag name
}

/**
 * Registry for parser configuration keys
 */
class ParserConfigRegistry {
  private registrations: Map<string, ParserConfigRegistration[]> = new Map();
  private globalFlagMap: Map<string, ParserConfigRegistration> = new Map();

  /**
   * Register a parser's configuration keys for global CLI usage
   */
  registerParserConfig(parser: ComponentParser) {
    const schema = parser.getConfigSchema?.();
    if (!schema || !schema.properties) {
      return [];
    }

    const registrations: ParserConfigRegistration[] = [];
    
    for (const [configKey, configSchema] of Object.entries(schema.properties)) {
      const globalFlag = `${parser.name}${configKey.charAt(0).toUpperCase()}${configKey.slice(1)}`;
      
      const registration: ParserConfigRegistration = {
        parserName: parser.name,
        configKey,
        schema: configSchema,
        globalFlag,
      };

      registrations.push(registration);
      this.globalFlagMap.set(globalFlag, registration);
    }

    this.registrations.set(parser.name, registrations);
    return registrations;
  }

  /**
   * Get all registered global flag names
   */
  getAllGlobalFlags(): string[] {
    return Array.from(this.globalFlagMap.keys());
  }

  /**
   * Get configuration schema for global flags
   */
  getGlobalFlagSchemas(): Record<string, any> {
    const schemas: Record<string, any> = {};
    
    for (const [globalFlag, registration] of this.globalFlagMap) {
      schemas[globalFlag] = {
        ...registration.schema,
        description: `[${registration.parserName}] ${registration.schema.description || ''}`,
      };
    }

    return schemas;
  }

  /**
   * Transform global flags into parser-specific configuration
   */
  transformConfig(globalFlags: Record<string, any>): Record<string, Record<string, any>> {
    const parserConfigs: Record<string, Record<string, any>> = {};

    for (const [globalFlag, value] of Object.entries(globalFlags)) {
      const registration = this.globalFlagMap.get(globalFlag);
      if (registration && value !== undefined) {
        if (!parserConfigs[registration.parserName]) {
          parserConfigs[registration.parserName] = {};
        }
        parserConfigs[registration.parserName][registration.configKey] = value;
      }
    }

    return parserConfigs;
  }

  /**
   * Get registrations for a specific parser
   */
  getParserRegistrations(parserName: string): ParserConfigRegistration[] {
    return this.registrations.get(parserName) || [];
  }

  /**
   * Clear all registrations (for testing)
   */
  clear() {
    this.registrations.clear();
    this.globalFlagMap.clear();
  }
}

// Global registry instance
export const parserConfigRegistry = new ParserConfigRegistry();

/**
 * Auto-register all available parsers
 */
export async function registerAllParsers() {
  // Import parsers dynamically to avoid circular dependencies
  try {
    const { StorybookParser } = await import('../parsers/implementations/storybook-parser');
    const { OpenAIParser } = await import('../parsers/implementations/openai-parser');
    const { CommentParser } = await import('../parsers/implementations/comment-parser-simple');

    // Register each parser
    parserConfigRegistry.registerParserConfig(new StorybookParser());
    parserConfigRegistry.registerParserConfig(new OpenAIParser());
    parserConfigRegistry.registerParserConfig(new CommentParser());

    return parserConfigRegistry.getAllGlobalFlags();
  } catch (error) {
    console.warn('Failed to auto-register parsers:', error);
    return [];
  }
}

/**
 * Enhanced configuration transformer that merges parser configs
 */
export function transformConfigWithParsers(
  globalFlags: Record<string, any>,
  existingConfig?: any
): any {
  // Get parser-specific configs from global flags
  const parserConfigs = parserConfigRegistry.transformConfig(globalFlags);

  // Merge with existing parser configurations
  const existingParsers = existingConfig?.parsers?.parsers || [];
  const updatedParsers = existingParsers.map((parser: any) => {
    const parserConfig = parserConfigs[parser.name];
    if (parserConfig) {
      return {
        ...parser,
        config: {
          ...parser.config,
          ...parserConfig,
        },
      };
    }
    return parser;
  });

  return {
    ...existingConfig,
    parsers: {
      ...existingConfig?.parsers,
      parsers: updatedParsers,
    },
  };
}

/**
 * Save transformer that properly structures config when saving to file
 * Converts flat parser flags into nested parser configuration structure
 */
export function saveConfigTransformer(rawConfig: any): any {
    console.log('Saving config with transformer:', rawConfig);
  // Extract parser-specific flags
  const parserConfigs = parserConfigRegistry.transformConfig(rawConfig);
  
  // Build the base configuration (removing parser-specific flags)
  const baseConfig: any = {};
  const parserGlobalFlags = parserConfigRegistry.getAllGlobalFlags();
  
  for (const [key, value] of Object.entries(rawConfig)) {
    if (!parserGlobalFlags.includes(key)) {
      baseConfig[key] = value;
    }
  }

  // Build parser configuration structure
  const parsersArray = rawConfig.parsers || ['comments'];
  const parserConfigurations = parsersArray.map((parserName: string) => {
    const parserConfig = parserConfigs[parserName] || {};
    
    // Get default config for this parser
    const registrations = parserConfigRegistry.getParserRegistrations(parserName);
    const defaultConfig: any = {};
    registrations.forEach(reg => {
      if (reg.schema.default !== undefined) {
        defaultConfig[reg.configKey] = reg.schema.default;
      }
    });

    return {
      name: parserName,
      enabled: true,
      weight: parserName === 'comments' ? 0 : parserName === 'storybook' ? 1 : 2,
      config: {
        ...defaultConfig,
        ...parserConfig,
      },
    };
  });

  console.log('Final parser configurations:', parserConfigurations);

  // Return properly structured configuration
  return {
    ...baseConfig,
    parserConfig: {
      enabled: true,
      mergeStrategy: 'merge',
      continueOnError: true,
      parsers: parserConfigurations,
    },
  };
}

/**
 * Load transformer that flattens parser configs back to top level
 * Takes nested parserConfig.parserName.variableName and creates
 * top-level parserNameVariableName flags for CLI prefilling
 */
export function loadConfigTransformer(structuredConfig: any): any {
  const flattenedConfig = { ...structuredConfig };
  
  // Extract parser configurations and flatten them to top level
  if (structuredConfig.parserConfig?.parsers) {
    structuredConfig.parserConfig.parsers.forEach((parser: any) => {
      const parserName = parser.name;
      const parserConfig = parser.config || {};
      
      // Get registrations for this parser to know the correct global flag names
      const registrations = parserConfigRegistry.getParserRegistrations(parserName);
      
      registrations.forEach(registration => {
        const configValue = parserConfig[registration.configKey];
        if (configValue !== undefined) {
          flattenedConfig[registration.globalFlag] = configValue;
        }
      });
    });
  }
  
  // Also flatten the parsers array for CLI compatibility
  if (structuredConfig.parserConfig?.parsers) {
    flattenedConfig.parsers = structuredConfig.parserConfig.parsers
      .filter((p: any) => p.enabled)
      .map((p: any) => p.name);
  }
  
  return flattenedConfig;
}