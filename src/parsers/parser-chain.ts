import {
  ComponentParser,
  ParseContext,
  ParseResult,
  ParserChainConfig,
  ComponentAnalysis,
  Diagnostic,
} from './parser-interface';
import ora from 'ora';

/**
 * Manages a chain of component parsers
 */
export class ParserChain {
  private parsers: Map<string, ComponentParser> = new Map();

  /**
   * Register a parser
   */
  registerParser(parser: ComponentParser): void {
    this.parsers.set(parser.name, parser);
  }

  /**
   * Get all registered parsers
   */
  getAvailableParsers(): ComponentParser[] {
    return Array.from(this.parsers.values());
  }

  /**
   * Execute the parser chain
   */
  async execute(
    context: ParseContext,
    config: ParserChainConfig,
    logger?: any,
    theme?: any,
  ): Promise<ParseResult[]> {
    const results: ParseResult[] = [];
    const diagnostics: Diagnostic[] = [];

    // Filter and sort enabled parsers
    const enabledParsers = config.parsers
      .filter((pc) => pc.enabled && this.parsers.has(pc.name))
      .sort((a, b) => (a.weight || 0) - (b.weight || 0))
      .map((pc) => ({
        parser: this.parsers.get(pc.name)!,
        config: pc.config || {},
      }));

    if (logger) {
      // Extract file name for display
      const fileName = context.storyFilePath.split('/').pop() || 'unknown';
      logger.log(`\n📄 Processing: ${fileName}`);
    }

    for (const { parser, config: parserConfig } of enabledParsers) {
      let spinner;
      
      try {
        // Check if parser can handle this context
        if (!parser.canParse(context)) {
          if (logger) {
            logger.log(`  ├─ Skipping ${parser.name} (cannot handle context)`);
          }
          continue;
        }

        // Start spinner for this parser
        if (logger) {
          spinner = ora(`  ├─ Running ${parser.name}...`).start();
        }

        // Create context with parser-specific config and previous results
        const parserContext: ParseContext = {
          ...context,
          config: parserConfig,
          previousResults: [...results], // Copy previous results
        };

        // Execute parser
        const result = await parser.parse(parserContext);
        results.push(result);

        // Stop spinner and show success
        if (spinner) {
          spinner.succeed(`  ├─ ${parser.name} completed`);
        } else if (logger) {
          logger.log(`  ├─ ${parser.name} completed`);
        }
      } catch (error) {
        // Stop spinner and show error
        if (spinner) {
          spinner.fail(`  ├─ ${parser.name} failed`);
        } else if (logger) {
          logger.log(`  ├─ ${parser.name} failed`);
        }

        const diagnostic: Diagnostic = {
          level: 'error',
          message: `Parser ${parser.name} failed: ${error instanceof Error ? error.message : String(error)}`,
          source: parser.name,
        };

        diagnostics.push(diagnostic);
        
        if (logger) {
          logger.error(`    └─ Error: ${diagnostic.message}`);
        }

        if (!config.continueOnError) {
          throw new Error(
            `Parser chain failed at ${parser.name}: ${diagnostic.message}`,
          );
        }
      }
    }

    // Add any chain-level diagnostics to the last result
    if (diagnostics.length > 0 && results.length > 0) {
      const lastResult = results[results.length - 1];
      lastResult.diagnostics = [
        ...(lastResult.diagnostics || []),
        ...diagnostics,
      ];
    }

    return results;
  }

  /**
   * Merge multiple parse results into a single component analysis
   */
  mergeResults(
    results: ParseResult[],
    strategy: 'append' | 'merge' | 'override' = 'merge',
  ): ComponentAnalysis[] {
    if (results.length === 0) return [];

    const componentMap = new Map<string, ComponentAnalysis>();

    for (const result of results) {
      for (const component of result.components) {
        const key = component.name.toLowerCase();

        if (!componentMap.has(key)) {
          // First occurrence of this component
          componentMap.set(key, {
            ...component,
            customData: {
              ...component.customData,
              parsers: [result.parser],
            },
          });
        } else {
          const existing = componentMap.get(key)!;

          switch (strategy) {
            case 'append':
              // Keep existing, add new data as custom data
              existing.customData = {
                ...existing.customData,
                [`${result.parser}_data`]: component,
                parsers: [
                  ...(existing.customData?.parsers || []),
                  result.parser,
                ],
              };
              break;

            case 'override':
              // Replace with latest
              componentMap.set(key, {
                ...component,
                customData: {
                  ...component.customData,
                  parsers: [result.parser],
                  previousData: existing,
                },
              });
              break;

            case 'merge':
            default:
              // Merge intelligently
              const merged: ComponentAnalysis = {
                name: component.name || existing.name,
                description: this.mergeDescriptions(
                  existing.description,
                  component.description,
                ),
                category: component.category || existing.category,
                tags: this.mergeTags(existing.tags, component.tags),
                importPath: component.importPath || existing.importPath,
                props: this.mergeProps(existing.props, component.props),
                slots: this.mergeSlots(existing.slots, component.slots),
                examples: this.mergeExamples(
                  existing.examples,
                  component.examples,
                ),
                dependencies: this.mergeDependencies(
                  existing.dependencies,
                  component.dependencies,
                ),
                relatedComponents: this.mergeRelatedComponents(
                  existing.relatedComponents,
                  component.relatedComponents,
                ),
                accessibility: this.mergeAccessibility(
                  existing.accessibility,
                  component.accessibility,
                ),
                customData: {
                  ...existing.customData,
                  ...component.customData,
                  parsers: [
                    ...(existing.customData?.parsers || []),
                    result.parser,
                  ],
                  [`${result.parser}_contribution`]: {
                    description: component.description,
                    tags: component.tags,
                    props: component.props,
                    accessibility: component.accessibility,
                  },
                },
              };
              componentMap.set(key, merged);
              break;
          }
        }
      }
    }

    return Array.from(componentMap.values());
  }

  private mergeDescriptions(existing?: string, newDesc?: string): string {
    if (!existing) return newDesc || '';
    if (!newDesc) return existing;
    if (existing === newDesc) return existing;

    // If new description is more detailed (longer), prefer it
    if (newDesc.length > existing.length * 1.5) {
      return newDesc;
    }

    return existing;
  }

  private mergeTags(existing?: string[], newTags?: string[]): string[] {
    const combined = new Set([...(existing || []), ...(newTags || [])]);
    return Array.from(combined);
  }

  private mergeProps(existing?: any[], newProps?: any[]): any[] {
    if (!existing) return newProps || [];
    if (!newProps) return existing;

    const propMap = new Map();

    // Add existing props
    existing.forEach((prop) => propMap.set(prop.name, prop));

    // Merge new props
    newProps.forEach((prop) => {
      if (propMap.has(prop.name)) {
        const existingProp = propMap.get(prop.name);
        propMap.set(prop.name, {
          ...existingProp,
          ...prop,
          description: prop.description || existingProp.description,
        });
      } else {
        propMap.set(prop.name, prop);
      }
    });

    return Array.from(propMap.values());
  }

  private mergeSlots(existing?: any[], newSlots?: any[]): any[] {
    if (!existing) return newSlots || [];
    if (!newSlots) return existing;

    const slotMap = new Map();
    existing.forEach((slot) => slotMap.set(slot.name, slot));
    newSlots.forEach((slot) => {
      if (slotMap.has(slot.name)) {
        const existingSlot = slotMap.get(slot.name);
        slotMap.set(slot.name, { ...existingSlot, ...slot });
      } else {
        slotMap.set(slot.name, slot);
      }
    });

    return Array.from(slotMap.values());
  }

  private mergeExamples(existing?: any[], newExamples?: any[]): any[] {
    if (!existing) return newExamples || [];
    if (!newExamples) return existing;

    const exampleMap = new Map();
    existing.forEach((ex) => exampleMap.set(ex.title, ex));
    newExamples.forEach((ex) => {
      if (!exampleMap.has(ex.title)) {
        exampleMap.set(ex.title, ex);
      }
    });

    return Array.from(exampleMap.values());
  }

  private mergeDependencies(existing?: string[], newDeps?: string[]): string[] {
    const combined = new Set([...(existing || []), ...(newDeps || [])]);
    return Array.from(combined);
  }

  private mergeRelatedComponents(
    existing?: string[],
    newRelated?: string[],
  ): string[] {
    const combined = new Set([...(existing || []), ...(newRelated || [])]);
    return Array.from(combined);
  }

  private mergeAccessibility(existing?: any[], newA11y?: any[]): any[] {
    if (!existing) return newA11y || [];
    if (!newA11y) return existing;

    const a11yMap = new Map();
    existing.forEach((item) => a11yMap.set(`${item.type}:${item.value}`, item));
    newA11y.forEach((item) => {
      const key = `${item.type}:${item.value}`;
      if (!a11yMap.has(key)) {
        a11yMap.set(key, item);
      }
    });

    return Array.from(a11yMap.values());
  }
}
