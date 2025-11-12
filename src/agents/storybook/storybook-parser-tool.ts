import { AgentTool } from '../agent-tool';
import { readFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import type {
  ComponentDefinition,
  Framework,
  DesignLibrary,
} from '../../models';

/**
 * Tool for parsing Storybook files and generating context files
 */
export class StorybookParserTool extends AgentTool {
  constructor() {
    const config = {
      name: 'parse_storybook_file',
      config: {
        description: 'Parse a Storybook file and generate component context',
        parameters: {
          type: 'object',
          properties: {
            storyFilePath: {
              type: 'string',
              description: 'Absolute path to the Storybook file to parse',
            },
            componentFilePath: {
              type: 'string',
              description:
                'Absolute path to the component file referenced by the story',
            },
            framework: {
              type: 'string',
              enum: ['react', 'vue', 'angular', 'svelte', 'web-components'],
              description: 'Framework being used',
            },
            designLibrary: {
              type: 'string',
              enum: [
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
              description: 'Design library being used',
            },
          },
          required: ['storyFilePath', 'componentFilePath', 'framework'],
        },
      },
      handler: (
        id: string,
        params: string,
        config: { accountId: string; projectId: string },
      ) => this.handleParseStorybook(id, params, config),
    };

    super(config);
  }

  private async handleParseStorybook(
    id: string,
    params: string,
    config: { accountId: string; projectId: string },
  ) {
    try {
      const { storyFilePath, componentFilePath, framework, designLibrary } =
        JSON.parse(params);

      // Read the story file content
      const storyContent = readFileSync(storyFilePath, 'utf-8');

      // Read the component file content
      const componentContent = readFileSync(componentFilePath, 'utf-8');

      // Parse the component definition
      const componentDefinition = this.parseComponentFromFiles(
        storyContent,
        componentContent,
        storyFilePath,
        componentFilePath,
        framework,
        designLibrary,
      );

      // Generate context file content
      const contextContent = this.generateContextFile(componentDefinition);

      return {
        tool_call_id: id,
        role: 'tool' as const,
        content: JSON.stringify({
          success: true,
          componentDefinition,
          contextContent,
          message: `Successfully parsed component: ${componentDefinition.name}`,
        }),
      };
    } catch (error) {
      return {
        tool_call_id: id,
        role: 'tool' as const,
        content: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
  }

  private parseComponentFromFiles(
    storyContent: string,
    componentContent: string,
    storyFilePath: string,
    componentFilePath: string,
    framework: string,
    designLibrary?: string,
  ): ComponentDefinition {
    // Extract component name from file path
    const componentName = basename(componentFilePath)
      .replace(/\.(jsx?|tsx?|vue|svelte)$/, '')
      .replace(/\.(component|index)$/, '');

    // Basic parsing - this can be enhanced with more sophisticated parsing
    const componentDefinition: ComponentDefinition = {
      name: componentName,
      displayName: componentName,
      description: this.extractDescription(storyContent, componentContent),
      framework: framework as Framework,
      tags: this.extractTags(componentName, storyContent, componentContent),
      category: this.inferCategory(
        componentName,
        storyContent,
        componentContent,
      ),
      importPath: this.generateImportPath(componentFilePath, componentName),
      props: this.extractProps(componentContent, framework),
      slots: this.extractSlots(componentContent, framework),
      variants: [],
      examples: this.extractExamples(storyContent, componentName),
      storyFile: storyFilePath,
    };

    return componentDefinition;
  }

  private extractDescription(
    storyContent: string,
    componentContent: string,
  ): string {
    // Look for JSDoc comments or story descriptions
    const jsdocMatch = componentContent.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n/);
    if (jsdocMatch) {
      return jsdocMatch[1];
    }

    // Look for story title or description
    const storyTitleMatch = storyContent.match(/title:\s*['"`]([^'"`]+)['"`]/);
    if (storyTitleMatch) {
      return `Component from ${storyTitleMatch[1]}`;
    }

    return `Component parsed from Storybook file`;
  }

  private extractTags(
    componentName: string,
    storyContent: string,
    componentContent: string,
  ): string[] {
    const tags: string[] = [];
    const name = componentName.toLowerCase();

    // Infer tags from component name
    if (name.includes('button')) tags.push('button');
    if (name.includes('input') || name.includes('field'))
      tags.push('input', 'form');
    if (name.includes('modal') || name.includes('dialog')) tags.push('overlay');
    if (name.includes('card') || name.includes('panel')) tags.push('layout');
    if (name.includes('nav') || name.includes('menu')) tags.push('navigation');
    if (name.includes('icon')) tags.push('icon');
    if (
      name.includes('text') ||
      name.includes('heading') ||
      name.includes('title')
    )
      tags.push('typography');

    // Look for explicit tags in story content
    const tagsMatch = storyContent.match(/tags:\s*\[([^\]]+)\]/);
    if (tagsMatch) {
      const storyTags = tagsMatch[1]
        .split(',')
        .map((tag) => tag.trim().replace(/['"`]/g, ''));
      tags.push(...storyTags);
    }

    return tags.length > 0 ? [...new Set(tags)] : ['component'];
  }

  private inferCategory(
    componentName: string,
    storyContent: string,
    componentContent: string,
  ): string {
    const name = componentName.toLowerCase();

    if (name.includes('button') || name.includes('link')) return 'actions';
    if (
      name.includes('input') ||
      name.includes('form') ||
      name.includes('field')
    )
      return 'forms';
    if (
      name.includes('modal') ||
      name.includes('dialog') ||
      name.includes('popup')
    )
      return 'overlays';
    if (
      name.includes('card') ||
      name.includes('panel') ||
      name.includes('container')
    )
      return 'layout';
    if (
      name.includes('nav') ||
      name.includes('menu') ||
      name.includes('breadcrumb')
    )
      return 'navigation';
    if (
      name.includes('table') ||
      name.includes('list') ||
      name.includes('grid')
    )
      return 'data-display';
    if (name.includes('icon') || name.includes('image')) return 'media';

    return 'general';
  }

  private generateImportPath(
    componentFilePath: string,
    componentName: string,
  ): string {
    // Generate a relative import path - this is a simplified version
    const fileName = basename(componentFilePath, '.tsx').replace(
      /\.component$/,
      '',
    );
    return `import { ${componentName} } from './${fileName}';`;
  }

  private extractProps(componentContent: string, framework: string): any[] {
    // This is a basic implementation - can be enhanced with AST parsing
    const props: any[] = [];

    if (framework === 'react') {
      // Look for TypeScript interface or type definitions
      const interfaceMatch = componentContent.match(
        /interface\s+\w*Props\s*{([^}]+)}/,
      );
      if (interfaceMatch) {
        const propsText = interfaceMatch[1];
        const propMatches = propsText.match(/(\w+)(\?)?\s*:\s*([^;]+);/g);

        if (propMatches) {
          propMatches.forEach((propMatch) => {
            const [, name, optional, type] =
              propMatch.match(/(\w+)(\?)?\s*:\s*([^;]+);/) || [];
            if (name && type) {
              props.push({
                name,
                type: this.mapTypeScriptType(type.trim()),
                required: !optional,
                description: `${name} property`,
              });
            }
          });
        }
      }
    }

    return props;
  }

  private extractSlots(componentContent: string, framework: string): any[] {
    // Basic slot extraction - can be enhanced
    const slots: any[] = [];

    if (framework === 'react') {
      // Look for children prop or render props
      if (componentContent.includes('children')) {
        slots.push({
          name: 'children',
          description: 'Child elements to render inside the component',
          required: false,
        });
      }
    }

    return slots;
  }

  private extractExamples(storyContent: string, componentName: string): any[] {
    const examples: any[] = [];

    // Look for story exports
    const storyMatches = storyContent.match(/export const (\w+) = [^;]+/g);
    if (storyMatches) {
      storyMatches.forEach((storyMatch) => {
        const storyName = storyMatch.match(/export const (\w+) = /)?.[1];
        if (storyName && storyName !== 'default') {
          examples.push({
            title: storyName,
            description: `${storyName} example`,
            code: `<${componentName} {...${storyName}.args} />`,
          });
        }
      });
    }

    // Add a basic example if no stories found
    if (examples.length === 0) {
      examples.push({
        title: 'Basic',
        description: 'Basic usage example',
        code: `<${componentName} />`,
      });
    }

    return examples;
  }

  private mapTypeScriptType(tsType: string): string {
    const type = tsType.toLowerCase();
    if (type.includes('string')) return 'string';
    if (type.includes('number')) return 'number';
    if (type.includes('boolean')) return 'boolean';
    if (type.includes('function') || type.includes('=>')) return 'function';
    if (type.includes('[]') || type.includes('array')) return 'array';
    if (type.includes('object') || type.startsWith('{')) return 'object';
    return 'string'; // default fallback
  }

  private generateContextFile(
    componentDefinition: ComponentDefinition,
  ): string {
    const contextFile = {
      metadata: {
        generatedAt: new Date().toISOString(),
        tool: 'storybook-parser-agent',
      },
      component: {
        id: componentDefinition.name.toLowerCase().replace(/\s+/g, '-'),
        name: componentDefinition.name,
        description: componentDefinition.description,
        category: componentDefinition.category,
        tags: componentDefinition.tags,
        importStatement: componentDefinition.importPath,
        basicUsage:
          componentDefinition.examples[0]?.code ||
          `<${componentDefinition.name} />`,
        propsSchema: componentDefinition.props,
        slots: componentDefinition.slots,
        codeExamples: {
          basic:
            componentDefinition.examples[0]?.code ||
            `<${componentDefinition.name} />`,
          advanced: componentDefinition.examples[1]?.code,
        },
        framework: componentDefinition.framework,
        storyFile: componentDefinition.storyFile,
      },
    };

    return JSON.stringify(contextFile, null, 2);
  }
}
