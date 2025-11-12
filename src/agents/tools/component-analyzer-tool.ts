import { AgentTool } from '../agent-tool';
import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve, extname } from 'path';
import { glob } from 'glob';

interface ComponentAnalysis {
  name: string;
  description: string;
  props: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
    defaultValue?: string;
  }>;
  slots: Array<{
    name: string;
    description?: string;
    required: boolean;
  }>;
  tags: string[];
  category: string;
  dependencies: string[];
  relatedComponents: string[];
  importPath: string;
  accessibility?: {
    ariaLabels?: string[];
    keyboardSupport?: string[];
    semanticRoles?: string[];
  };
}

class ComponentAnalyzer {
  async analyzeComponent(
    componentFilePath: string,
    storyFilePath: string,
    framework: string,
    baseImportPath?: string,
  ): Promise<ComponentAnalysis> {
    const analysis: ComponentAnalysis = {
      name: '',
      description: '',
      props: [],
      slots: [],
      tags: [],
      category: 'general',
      dependencies: [],
      relatedComponents: [],
      importPath: '',
      accessibility: {},
    };

    // Read component file
    let componentContent = '';
    if (existsSync(componentFilePath)) {
      componentContent = readFileSync(componentFilePath, 'utf-8');
    }

    // Read story file for additional context
    let storyContent = '';
    if (existsSync(storyFilePath)) {
      storyContent = readFileSync(storyFilePath, 'utf-8');
    }

    // Extract component name
    analysis.name = this.extractComponentName(
      componentFilePath,
      componentContent,
    );

    // Extract description from comments or story metadata
    analysis.description = this.extractDescription(
      componentContent,
      storyContent,
    );

    // Analyze props based on framework
    analysis.props = this.extractProps(componentContent, framework);

    // Extract slots/children patterns
    analysis.slots = this.extractSlots(componentContent, framework);

    // Generate tags based on analysis
    analysis.tags = this.generateTags(componentContent, storyContent, analysis);

    // Determine category
    analysis.category = this.determineCategory(
      analysis.name,
      componentContent,
      storyContent,
    );

    // Extract dependencies
    analysis.dependencies = this.extractDependencies(componentContent);

    // Find related components
    analysis.relatedComponents = await this.findRelatedComponents(
      componentFilePath,
      analysis.name,
    );

    // Generate import path
    analysis.importPath = this.generateImportPath(
      componentFilePath,
      analysis.name,
      baseImportPath,
    );

    // Extract accessibility information
    analysis.accessibility = this.extractAccessibilityInfo(
      componentContent,
      storyContent,
    );

    return analysis;
  }

  private extractComponentName(filePath: string, content: string): string {
    // Try to extract from export statements
    const exportMatches = content.match(
      /export\s+(?:default\s+)?(?:const\s+|function\s+|class\s+)?(\w+)/g,
    );
    if (exportMatches) {
      const mainExport = exportMatches
        .map((match) => match.match(/(\w+)$/)?.[1])
        .filter((name) => name && name !== 'default')
        .find((name) => name && /^[A-Z]/.test(name)); // Find capitalized exports

      if (mainExport) return mainExport;
    }

    // Fallback to filename
    const fileName =
      filePath
        .split('/')
        .pop()
        ?.replace(/\.(tsx?|jsx?|vue)$/, '') || 'Unknown';
    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }

  private extractDescription(
    componentContent: string,
    storyContent: string,
  ): string {
    // Look for JSDoc comments
    const jsdocMatch = componentContent.match(
      /\/\*\*\s*\n\s*\*\s*([^*\n]+(?:\n\s*\*\s*[^*\n]+)*)/,
    );
    if (jsdocMatch) {
      return jsdocMatch[1].replace(/\n\s*\*\s*/g, ' ').trim();
    }

    // Look for story title or description
    const titleMatch = storyContent.match(/title:\s*['"`]([^'"`]+)['"`]/);
    if (titleMatch) {
      return `${titleMatch[1]} component`;
    }

    // Look for single-line comments above component
    const commentMatch = componentContent.match(
      /\/\/\s*([^\n]+)\s*\n(?:export\s+(?:default\s+)?(?:const\s+|function\s+|class\s+)?\w+)/,
    );
    if (commentMatch) {
      return commentMatch[1].trim();
    }

    return 'A reusable component';
  }

  private extractProps(
    content: string,
    framework: string,
  ): ComponentAnalysis['props'] {
    const props: ComponentAnalysis['props'] = [];

    if (framework === 'react') {
      // Look for TypeScript interfaces or types
      const interfaceMatch = content.match(
        /interface\s+\w*Props?\s*{([^}]+)}/s,
      );
      const typeMatch = content.match(/type\s+\w*Props?\s*=\s*{([^}]+)}/s);

      const propsContent = interfaceMatch?.[1] || typeMatch?.[1];
      if (propsContent) {
        const propLines = propsContent
          .split(/[,;]/)
          .filter((line) => line.trim());

        for (const line of propLines) {
          const propMatch = line.match(
            /^\s*(\w+)(\?)?\s*:\s*([^=\n]+)(?:\s*=\s*([^;\n]+))?/,
          );
          if (propMatch) {
            const [, name, optional, type, defaultValue] = propMatch;

            // Extract JSDoc comment for this prop
            const jsdocPattern = new RegExp(
              `/\\*\\*[^*]*\\*\\s*([^*\\n]+(?:\\n\\s*\\*\\s*[^*\\n]+)*)\\s*\\*/\\s*${name}`,
              's',
            );
            const jsdocMatch = content.match(jsdocPattern);
            const description = jsdocMatch?.[1]
              ?.replace(/\n\s*\*\s*/g, ' ')
              .trim();

            props.push({
              name: name.trim(),
              type: type.trim(),
              required: !optional,
              description,
              defaultValue: defaultValue?.trim(),
            });
          }
        }
      }

      // Also look for PropTypes (for JS React components)
      const propTypesMatch = content.match(/\.propTypes\s*=\s*{([^}]+)}/s);
      if (propTypesMatch && props.length === 0) {
        const propTypesContent = propTypesMatch[1];
        const propTypeLines = propTypesContent
          .split(',')
          .filter((line) => line.trim());

        for (const line of propTypeLines) {
          const propMatch = line.match(
            /^\s*(\w+)\s*:\s*PropTypes\.(\w+)(?:\.isRequired)?/,
          );
          if (propMatch) {
            const [, name, type] = propMatch;
            const required = line.includes('.isRequired');

            props.push({
              name: name.trim(),
              type: type,
              required,
              description: `${name} prop`,
            });
          }
        }
      }
    }

    return props;
  }

  private extractSlots(
    content: string,
    framework: string,
  ): ComponentAnalysis['slots'] {
    const slots: ComponentAnalysis['slots'] = [];

    if (framework === 'react') {
      // Look for children prop
      if (
        content.includes('children') &&
        !slots.find((s) => s.name === 'children')
      ) {
        slots.push({
          name: 'children',
          description: 'Child elements to render inside the component',
          required: false,
        });
      }

      // Look for render props or slot-like patterns
      const renderPropMatches = content.match(
        /(\w+)Render|render(\w+)|(\w+)Slot/gi,
      );
      if (renderPropMatches) {
        renderPropMatches.forEach((match) => {
          const slotName = match.toLowerCase().replace(/render|slot/gi, '');
          if (slotName && !slots.find((s) => s.name === slotName)) {
            slots.push({
              name: slotName,
              description: `Slot for ${slotName} content`,
              required: false,
            });
          }
        });
      }
    }

    return slots;
  }

  private generateTags(
    componentContent: string,
    storyContent: string,
    analysis: ComponentAnalysis,
  ): string[] {
    const tags = new Set<string>();

    // Add framework tag
    if (componentContent.includes('import React')) {
      tags.add('react');
    }

    // UI element tags based on content
    if (componentContent.match(/button|Button/i)) tags.add('interactive');
    if (componentContent.match(/input|Input|field|Field/i)) tags.add('form');
    if (componentContent.match(/modal|Modal|dialog|Dialog/i))
      tags.add('overlay');
    if (componentContent.match(/card|Card|panel|Panel/i)) tags.add('layout');
    if (componentContent.match(/icon|Icon|svg/i)) tags.add('icon');
    if (componentContent.match(/text|Text|typography|Typography/i))
      tags.add('typography');
    if (componentContent.match(/table|Table|grid|Grid/i))
      tags.add('data-display');

    // Accessibility tags
    if (componentContent.match(/aria-|role=|tabIndex/)) tags.add('accessible');
    if (componentContent.match(/keyboard|onKeyDown|onKeyUp/))
      tags.add('keyboard-navigation');

    // Story-based tags
    if (storyContent.match(/disabled|Disabled/)) tags.add('stateful');
    if (storyContent.match(/variant|Variant|size|Size/))
      tags.add('customizable');

    // Prop-based tags
    if (analysis.props.some((p) => p.name.includes('variant')))
      tags.add('variants');
    if (analysis.props.some((p) => p.name.includes('size'))) tags.add('sizing');
    if (analysis.props.some((p) => p.name.includes('color')))
      tags.add('theming');

    return Array.from(tags);
  }

  private determineCategory(
    name: string,
    componentContent: string,
    storyContent: string,
  ): string {
    const content = (componentContent + storyContent).toLowerCase();

    if (content.match(/button|link|anchor/)) return 'actions';
    if (content.match(/input|textarea|select|checkbox|radio|form/))
      return 'forms';
    if (content.match(/modal|dialog|tooltip|popover|dropdown/))
      return 'overlays';
    if (content.match(/card|panel|container|layout|grid|flex/)) return 'layout';
    if (content.match(/text|heading|title|paragraph|typography/))
      return 'typography';
    if (content.match(/icon|image|avatar|badge/)) return 'media';
    if (content.match(/table|list|tree|data|chart/)) return 'data-display';
    if (content.match(/tab|accordion|carousel|stepper/)) return 'navigation';
    if (content.match(/alert|toast|notification|banner/)) return 'feedback';
    if (content.match(/progress|spinner|skeleton|loading/)) return 'indicators';

    return 'general';
  }

  private extractDependencies(content: string): string[] {
    const dependencies = new Set<string>();

    // Extract import statements
    const importMatches = content.match(
      /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
    );
    if (importMatches) {
      importMatches.forEach((importStatement) => {
        const moduleMatch = importStatement.match(/from\s+['"`]([^'"`]+)['"`]/);
        if (moduleMatch) {
          const module = moduleMatch[1];
          // Filter out relative imports and focus on external dependencies
          if (!module.startsWith('.') && !module.startsWith('/')) {
            dependencies.add(module);
          }
        }
      });
    }

    return Array.from(dependencies);
  }

  private async findRelatedComponents(
    componentFilePath: string,
    componentName: string,
  ): Promise<string[]> {
    const related = new Set<string>();
    const componentDir = dirname(componentFilePath);
    const projectRoot = resolve(componentDir, '../..');

    try {
      // Look for components in the same directory or nearby
      const nearbyFiles = await glob(
        `${componentDir}/../**/*.{tsx,jsx,ts,js}`,
        {
          ignore: [
            '**/node_modules/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/*.stories.*',
          ],
        },
      );

      for (const file of nearbyFiles.slice(0, 20)) {
        // Limit to prevent performance issues
        if (file === componentFilePath) continue;

        try {
          const content = readFileSync(file, 'utf-8');
          const fileName =
            file
              .split('/')
              .pop()
              ?.replace(/\.(tsx?|jsx?)$/, '') || '';

          // Check if this component imports or references our component
          if (content.includes(componentName) && fileName !== componentName) {
            const exportMatch = content.match(
              /export\s+(?:default\s+)?(?:const\s+|function\s+|class\s+)?(\w+)/,
            );
            if (exportMatch && exportMatch[1] !== componentName) {
              related.add(exportMatch[1]);
            }
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    } catch (error) {
      console.warn('Could not find related components:', error);
    }

    return Array.from(related).slice(0, 5); // Limit to top 5 related components
  }

  private generateImportPath(
    filePath: string,
    componentName: string,
    baseImportPath?: string,
  ): string {
    if (baseImportPath) {
      // Use the base import path if provided
      const relativePath = filePath.split('/').slice(-2, -1)[0]; // Get parent directory name
      return `${baseImportPath}/${relativePath}`;
    }

    // Generate relative import path
    const parts = filePath.split('/');
    const componentDir = parts[parts.length - 2];
    return `./${componentDir}/${componentName}`;
  }

  private extractAccessibilityInfo(
    componentContent: string,
    storyContent: string,
  ): ComponentAnalysis['accessibility'] {
    const accessibility: ComponentAnalysis['accessibility'] = {
      ariaLabels: [],
      keyboardSupport: [],
      semanticRoles: [],
    };

    const content = componentContent + storyContent;

    // Extract aria labels
    const ariaMatches = content.match(/aria-\w+/g);
    if (ariaMatches) {
      accessibility.ariaLabels = Array.from(new Set(ariaMatches));
    }

    // Extract keyboard event handlers
    const keyboardEvents = content.match(/on(Key\w+)/g);
    if (keyboardEvents) {
      accessibility.keyboardSupport = Array.from(new Set(keyboardEvents));
    }

    // Extract semantic roles
    const roleMatches = content.match(/role=['"`](\w+)['"`]/g);
    if (roleMatches) {
      accessibility.semanticRoles = roleMatches
        .map((match) => match.match(/role=['"`](\w+)['"`]/)?.[1] || '')
        .filter(Boolean);
    }

    return accessibility;
  }
}

const analyzer = new ComponentAnalyzer();

export const ComponentAnalyzerTool = new AgentTool({
  name: 'analyze_component',
  config: {
    description:
      'Analyze a component file and extract comprehensive information including props, slots, dependencies, and related components',
    parameters: {
      type: 'object',
      properties: {
        componentFilePath: {
          type: 'string',
          description: 'Path to the component file to analyze',
        },
        storyFilePath: {
          type: 'string',
          description: 'Path to the story file for additional context',
        },
        framework: {
          type: 'string',
          description: 'Framework being used (react, vue, angular, etc.)',
          default: 'react',
        },
        baseImportPath: {
          type: 'string',
          description: 'Base import path for the design system',
        },
      },
      required: ['componentFilePath', 'storyFilePath'],
    },
  },
  handler: async (
    id: string,
    args: string,
    context: { accountId: string; projectId: string },
  ) => {
    try {
      const parsedArgs = JSON.parse(args);
      const {
        componentFilePath,
        storyFilePath,
        framework = 'react',
        baseImportPath,
      } = parsedArgs;
      
      const analysis = await analyzer.analyzeComponent(
        componentFilePath,
        storyFilePath,
        framework,
        baseImportPath,
      );

      return {
        role: 'tool',
        tool_call_id: id,
        content: JSON.stringify(analysis, null, 2),
        actions: [`analyzed_component:${componentFilePath}`],
      };
    } catch (error) {
      console.error('Error in ComponentAnalyzerTool:', error);
      return {
        role: 'tool',
        tool_call_id: id,
        content: `Error analyzing component: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
