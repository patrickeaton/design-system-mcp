/**
 * Base interface for all component parsers
 */
export interface ComponentParser {
  /**
   * Unique identifier for this parser
   */
  readonly name: string;

  /**
   * Description of what this parser does
   */
  readonly description: string;

  /**
   * Parse a component and return analysis data
   */
  parse(context: ParseContext): Promise<ParseResult>;

  /**
   * Check if this parser can handle the given context
   */
  canParse(context: ParseContext): boolean;

  /**
   * Get the configuration schema for this parser
   */
  getConfigSchema?(): any;
}

/**
 * Context information passed to parsers
 */
export interface ParseContext {
  storyFilePath: string;
  componentFilePath?: string;
  framework: string;
  designLibrary?: string;
  baseImportPath?: string;
  config: any; // Parser-specific configuration
  previousResults?: ParseResult[]; // Results from previous parsers in the chain
}

/**
 * Result returned by a parser
 */
export interface ParseResult {
  /**
   * Parser that generated this result
   */
  parser: string;

  /**
   * When this result was generated
   */
  timestamp: string;

  /**
   * Component information extracted by this parser
   */
  components: ComponentAnalysis[];

  /**
   * Parser-specific metadata
   */
  metadata?: Record<string, any>;

  /**
   * Any errors or warnings from this parser
   */
  diagnostics?: Diagnostic[];
}

/**
 * Component analysis data structure
 */
export interface ComponentAnalysis {
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  importPath?: string;
  props?: PropDefinition[];
  slots?: SlotDefinition[];
  examples?: ExampleDefinition[];
  dependencies?: string[];
  relatedComponents?: string[];
  accessibility?: AccessibilityInfo[];
  customData?: Record<string, any>; // Parser-specific custom data
}

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

export interface SlotDefinition {
  name: string;
  description?: string;
  required: boolean;
}

export interface ExampleDefinition {
  title: string;
  code: string;
  description?: string;
}

export interface AccessibilityInfo {
  type: 'aria-label' | 'keyboard-support' | 'semantic-role' | 'other';
  value: string;
  description?: string;
}

export interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
  line?: number;
}

/**
 * Configuration for the parser chain
 */
export interface ParserChainConfig {
  parsers: ParserConfig[];
  mergeStrategy: 'append' | 'merge' | 'override';
  continueOnError: boolean;
}

export interface ParserConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
  weight?: number; // For merge ordering
}
