/**
 * Design System MCP Tool - TypeScript Models
 *
 * Models for parsing Storybook files and generating MCP context
 * for AI tools to understand and use design system components.
 */

// =============================================================================
// COMMON ENUMS AND TYPES
// =============================================================================

/**
 * Common component tags for categorization
 */
export enum CommonTags {
  INPUT = 'input',
  FORM = 'form',
  LAYOUT = 'layout',
  NAVIGATION = 'navigation',
  FEEDBACK = 'feedback',
  DATA_DISPLAY = 'data-display',
  OVERLAY = 'overlay',
  MEDIA = 'media',
  TYPOGRAPHY = 'typography',
  BUTTON = 'button',
  ICON = 'icon',
  UTILITY = 'utility',
}

/**
 * Component prop types
 */
export enum PropType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  ARRAY = 'array',
  FUNCTION = 'function',
  ENUM = 'enum',
  UNION = 'union',
  NODE = 'node', // React node/element
  COMPONENT = 'component',
}

/**
 * Framework types supported
 */
export enum Framework {
  REACT = 'react',
  VUE = 'vue',
  ANGULAR = 'angular',
  SVELTE = 'svelte',
  WEB_COMPONENTS = 'web-components',
}

/**
 * Design library types supported
 */
export enum DesignLibrary {
  MATERIAL_UI = 'mui',
  TAILWIND = 'tailwind',
  BOOTSTRAP = 'bootstrap',
  CHAKRA_UI = 'chakra',
  MANTINE = 'mantine',
  ANT_DESIGN = 'antd',
  SEMANTIC_UI = 'semantic',
  BULMA = 'bulma',
  FOUNDATION = 'foundation',
  CUSTOM = 'custom',
  NONE = 'none',
}

/**
 * Output mode types
 */
export enum OutputMode {
  SINGLE_FILE = 'single-file', // Generate one consolidated file
  INLINE_FILES = 'inline-files', // Generate individual context files next to story files
}

// =============================================================================
// THEME AND DESIGN TOKENS
// =============================================================================

/**
 * Color token definition
 */
export interface ColorToken {
  name: string;
  value: string;
  description?: string;
  category?: string; // e.g., 'primary', 'secondary', 'semantic'
}

/**
 * Typography token definition
 */
export interface TypographyToken {
  name: string;
  fontSize: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  fontFamily?: string;
  description?: string;
}

/**
 * Spacing token definition
 */
export interface SpacingToken {
  name: string;
  value: string;
  description?: string;
}

/**
 * Shadow token definition
 */
export interface ShadowToken {
  name: string;
  value: string;
  description?: string;
}

/**
 * Border radius token definition
 */
export interface BorderRadiusToken {
  name: string;
  value: string;
  description?: string;
}

/**
 * Complete theme configuration
 */
export interface ThemeConfig {
  name: string;
  description?: string;
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  shadows: ShadowToken[];
  borderRadius: BorderRadiusToken[];
  breakpoints?: Record<string, string>;
  zIndex?: Record<string, number>;
  custom?: Record<string, any>; // For framework-specific tokens
}

// =============================================================================
// COMPONENT MODELS
// =============================================================================

/**
 * Component prop definition
 */
export interface ComponentProp {
  name: string;
  type: PropType;
  required: boolean;
  defaultValue?: any;
  description?: string;
  enumValues?: string[]; // For enum/union types
  examples?: string[]; // Example values
}

/**
 * Component slot definition
 */
export interface ComponentSlot {
  name: string;
  description: string;
  required: boolean;
  allowedComponents?: string[]; // Specific components that can be slotted
  allowedTags?: string[]; // Tags of components that can be slotted
  examples?: string[]; // Example usage
}

/**
 * Component variant definition
 */
export interface ComponentVariant {
  name: string;
  description?: string;
  props: Record<string, any>; // Prop overrides for this variant
  example?: string; // Code example
}

/**
 * Usage example
 */
export interface UsageExample {
  title: string;
  description?: string;
  code: string;
  framework?: Framework;
  storyUrl?: string; // Link to Storybook story
  designUrl?: string; // Link to design (Figma, etc.)
}

/**
 * Individual component definition
 */
export interface ComponentDefinition {
  name: string;
  displayName?: string;
  description: string;
  framework: Framework;

  // Categorization
  tags: string[]; // Mix of CommonTags and custom tags
  category?: string; // High-level category

  // Implementation details
  importPath: string; // How to import this component
  props: ComponentProp[];
  slots: ComponentSlot[];
  variants: ComponentVariant[];

  // Documentation and examples
  examples: UsageExample[];
  storyFile?: string; // Path to the story file
  componentFile?: string; // Path to the actual component file
  documentationUrl?: string;

  // Accessibility
  a11yNotes?: string[];
  ariaProps?: string[]; // ARIA properties this component supports

  // Dependencies
  dependencies?: string[]; // Other components this depends on
  relatedComponents?: string[]; // Similar or related components

  // Metadata
  version?: string;
  deprecated?: boolean;
  deprecationMessage?: string;
  lastUpdated?: string;
}

// =============================================================================
// TOOL CONFIGURATION
// =============================================================================

/**
 * Storybook parsing configuration
 */
export interface StorybookConfig {
  storiesPattern: string[]; // Glob patterns for story files
  excludePatterns?: string[]; // Patterns to exclude
  framework: Framework;
  parseDecorators?: boolean; // Whether to parse story decorators
  parseParameters?: boolean; // Whether to parse story parameters
}

/**
 * Output configuration
 */
export interface OutputConfig {
  mode: OutputMode; // Whether to generate single file or inline files
  outputPath: string; // Where to write the MCP file (for single-file mode)
  format: 'json' | 'yaml'; // Output format
  includeTheme: boolean; // Whether to include theme in output
  includeExamples: boolean; // Whether to include code examples
  minify?: boolean; // Whether to minify output

  // Inline files configuration
  inlineFilePrefix?: string; // Prefix for inline context files (default: "")
  inlineFileExtension?: string; // Extension for inline files (default: ".dsm.json")
}

/**
 * Parser chain configuration
 */
export interface ParserChainConfiguration {
  enabled: boolean; // Whether to use parser chain (default: true)
  parsers: ParserConfiguration[];
  mergeStrategy: 'append' | 'merge' | 'override'; // How to merge parser results
  continueOnError: boolean; // Continue if a parser fails
}

export interface ParserConfiguration {
  name: 'storybook' | 'openai' | 'comments'; // Parser identifier
  enabled: boolean;
  weight?: number; // Execution order (lower = earlier)
  config?: Record<string, any>; // Parser-specific configuration
}

/**
 * Main tool configuration
 */
export interface DesignSystemConfig {
  name: string;
  version?: string;
  description?: string;

  // Directories
  rootDirectory: string; // Root directory to scan
  outputDirectory?: string; // Where to put generated files
  baseImportPath?: string; // Base import path for components (e.g., '@examples', '@components')

  // Parsing configuration
  storybook: StorybookConfig;

  // Design library configuration
  designLibrary?: DesignLibrary;

  // Theme configuration
  theme?: ThemeConfig;

  // Output configuration
  output: OutputConfig;

  // Parser configuration
  parsers?: ParserChainConfiguration;

  // Manual overrides
  manualComponents?: ComponentDefinition[]; // Manually defined components
  ignoreComponents?: string[]; // Component names to ignore

  // Metadata
  repository?: string;
  homepage?: string;
  license?: string;
}

// =============================================================================
// MCP OUTPUT MODELS
// =============================================================================

/**
 * MCP context for a single component
 */
export interface MCPComponentContext {
  id: string; // Unique identifier
  name: string;
  description: string;
  category: string;
  tags: string[];

  // Usage information
  importStatement: string;
  basicUsage: string;
  propsSchema: ComponentProp[];
  slots: ComponentSlot[];

  // Examples
  codeExamples: {
    basic: string;
    advanced?: string;
    withSlots?: string;
  };

  // Relationships
  relatedComponents: string[];
  dependencies: string[];

  // Accessibility
  accessibilityGuidelines?: string[];

  // Design tokens usage
  usedTokens?: {
    colors?: string[];
    typography?: string[];
    spacing?: string[];
  };
}

/**
 * Complete MCP output structure
 */
export interface MCPOutput {
  metadata: {
    name: string;
    version: string;
    description: string;
    framework: Framework;
    generatedAt: string;
    sourceDirectory: string;
  };

  // Design system information
  designSystem: {
    theme?: ThemeConfig;
    guidelines?: {
      spacing?: string;
      typography?: string;
      colors?: string;
      accessibility?: string;
    };
  };

  // Component library
  components: MCPComponentContext[];

  // Quick reference
  componentIndex: {
    byTag: Record<string, string[]>; // tag -> component names
    byCategory: Record<string, string[]>; // category -> component names
    alphabetical: string[]; // All component names sorted
  };

  // Usage patterns
  commonPatterns?: {
    name: string;
    description: string;
    components: string[];
    example: string;
  }[];
}
