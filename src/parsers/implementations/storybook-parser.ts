import {
  ComponentParser,
  ParseContext,
  ParseResult,
  ComponentAnalysis,
} from '../parser-interface';
import { parseStorybookFile } from '../../utils/storybook';

/**
 * Parser that extracts component information from Storybook files
 */
export class StorybookParser implements ComponentParser {
  readonly name = 'storybook';
  readonly description =
    'Extracts component information from Storybook files and component source code';

  canParse(context: ParseContext): boolean {
    // Can parse if we have a story file
    return !!context.storyFilePath;
  }

  async parse(context: ParseContext): Promise<ParseResult> {
    const startTime = Date.now();

    try {
      // Use existing parseStorybookFile function
      const components = await parseStorybookFile(
        context.storyFilePath,
        context.framework as any,
        { baseImportPath: context.baseImportPath },
      );

      // Convert to our ComponentAnalysis format
      const analysisComponents: ComponentAnalysis[] = components.map(
        (comp) => ({
          name: comp.name,
          description: comp.description,
          category: comp.category,
          tags: comp.tags,
          importPath: comp.importPath,
          props: comp.props.map((prop) => ({
            name: prop.name,
            type: prop.type,
            required: prop.required,
            description: prop.description,
            defaultValue: prop.defaultValue,
          })),
          slots: comp.slots.map((slot) => ({
            name: slot.name,
            description: slot.description,
            required: slot.required,
          })),
          examples: comp.examples.map((ex) => ({
            title: ex.title,
            code: ex.code,
            description: ex.description,
          })),
          dependencies: comp.dependencies,
          relatedComponents: comp.relatedComponents,
          accessibility: comp.a11yNotes
            ? comp.a11yNotes.map((note) => ({
                type: 'other' as const,
                value: note,
                description: 'Accessibility notes',
              }))
            : [],
          customData: {
            storybook: {
              storyFile: context.storyFilePath,
              framework: context.framework,
              variants: comp.variants,
            },
          },
        }),
      );

      const endTime = Date.now();

      return {
        parser: this.name,
        timestamp: new Date().toISOString(),
        components: analysisComponents,
        metadata: {
          storyFile: context.storyFilePath,
          componentFile: context.componentFilePath,
          framework: context.framework,
          executionTime: endTime - startTime,
        },
      };
    } catch (error) {
      throw new Error(
        `Storybook parser failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        extractVariants: {
          type: 'boolean',
          description: 'Extract component variants from stories',
          default: true,
        },
        extractExamples: {
          type: 'boolean',
          description: 'Extract code examples from stories',
          default: true,
        },
        parseComponentFile: {
          type: 'boolean',
          description:
            'Parse the actual component file for additional metadata',
          default: true,
        },
      },
    };
  }
}
