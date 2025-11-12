import { ComponentParser, ParseContext, ParseResult, ComponentAnalysis } from '../parser-interface';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';

/**
 * Parser that extracts @dsm comments from component source files
 */
export class CommentParser implements ComponentParser {
  readonly name = 'comments';
  readonly description = 'Extracts @dsm comments and manual annotations from component source files';
  
  canParse(context: ParseContext): boolean {
    // Can parse if we have a component file or can infer it from story file
    return !!(context.componentFilePath || context.storyFilePath);
  }
  
  async parse(context: ParseContext): Promise<ParseResult> {
    const startTime = Date.now();
    
    try {
      const componentFilePath = context.componentFilePath || this.inferComponentPath(context.storyFilePath);
      
      if (!componentFilePath || !existsSync(componentFilePath)) {
        return {
          parser: this.name,
          timestamp: new Date().toISOString(),
          components: [],
          metadata: {
            warning: 'No component file found to parse comments from'
          }
        };
      }
      
      const fileContent = readFileSync(componentFilePath, 'utf-8');
      const components = this.extractDsmComments(fileContent, componentFilePath, context);
      
      const endTime = Date.now();
      
      return {
        parser: this.name,
        timestamp: new Date().toISOString(),
        components,
        metadata: {
          componentFile: componentFilePath,
          executionTime: endTime - startTime,
          commentBlocks: components.length
        }
      };
      
    } catch (error) {
      throw new Error(`Comment parser failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private inferComponentPath(storyFilePath: string): string | null {
    if (!storyFilePath) return null;
    
    // Try common patterns for component files
    const basePath = storyFilePath.replace(/\.stories\.(tsx?|jsx?)$/, '');
    const possibleExtensions = ['.tsx', '.ts', '.jsx', '.js'];
    
    for (const ext of possibleExtensions) {
      const componentPath = basePath + ext;
      if (existsSync(componentPath)) {
        return componentPath;
      }
    }
    
    return null;
  }
  
  private extractDsmComments(content: string, filePath: string, context: ParseContext): ComponentAnalysis[] {
    const components: ComponentAnalysis[] = [];
    
    // Find all @dsm comment blocks
    const dsmBlocks = this.findDsmCommentBlocks(content);
    
    for (const block of dsmBlocks) {
      const component = this.parseDsmBlock(block, filePath, context);
      if (component) {
        components.push(component);
      }
    }
    
    // If no @dsm blocks found, look for manual entries in the file
    if (components.length === 0) {
      const manualComponent = this.extractManualEntries(content, filePath, context);
      if (manualComponent) {
        components.push(manualComponent);
      }
    }
    
    return components;
  }
  
  private findDsmCommentBlocks(content: string): string[] {
    const blocks: string[] = [];
    
    // Match both /* @dsm ... */ and /** @dsm ... */ style comments
    const blockCommentRegex = /\/\*\*?\s*@dsm([\s\S]*?)\*\//g;
    let match;
    
    while ((match = blockCommentRegex.exec(content)) !== null) {
      blocks.push(match[1].trim());
    }
    
    // Also match // @dsm style comments (multi-line)
    const lineCommentRegex = /\/\/\s*@dsm\s*(.*?)(?=\n(?!\s*\/\/\s*@dsm))/gs;
    while ((match = lineCommentRegex.exec(content)) !== null) {
      blocks.push(match[1].trim());
    }
    
    return blocks;
  }
  
  private parseDsmBlock(block: string, filePath: string, context: ParseContext): ComponentAnalysis | null {
    try {
      // Try to parse as JSON first
      if (block.trim().startsWith('{')) {
        const parsed = JSON.parse(block);
        return this.convertJsonToComponentAnalysis(parsed, filePath);
      }
      
      // Parse as structured comments
      return this.parseStructuredComments(block, filePath, context);
      
    } catch (error) {
      console.warn(`Failed to parse @dsm block in ${filePath}:`, error);
      return null;
    }
  }
  
  private convertJsonToComponentAnalysis(json: any, filePath: string): ComponentAnalysis {
    return {
      name: json.name || this.extractComponentNameFromFile(filePath),
      description: json.description || '',
      category: json.category,
      tags: json.tags || [],
      importPath: json.importPath,
      props: json.props || [],
      slots: json.slots || [],
      examples: json.examples || [],
      dependencies: json.dependencies || [],
      relatedComponents: json.relatedComponents || [],
      accessibility: json.accessibility || [],
      customData: {
        comments: {
          source: 'json-block',
          filePath,
          manual: true,
          originalData: json
        }
      }
    };
  }
  
  private parseStructuredComments(block: string, filePath: string, context: ParseContext): ComponentAnalysis {
    const lines = block.split('\\n').map(line => line.trim());
    const component: ComponentAnalysis = {
      name: this.extractComponentNameFromFile(filePath),
      description: '',
      customData: {
        comments: {
          source: 'structured-comments',
          filePath,
          manual: true
        }
      }
    };
    
    let currentSection = '';
    
    for (const line of lines) {
      if (line.startsWith('@name:')) {
        component.name = line.substring(6).trim();
      } else if (line.startsWith('@description:')) {
        component.description = line.substring(13).trim();
      } else if (line.startsWith('@category:')) {
        component.category = line.substring(10).trim();
      } else if (line.startsWith('@tags:')) {
        component.tags = line.substring(6).split(',').map(t => t.trim());
      } else if (line.startsWith('@import:')) {
        component.importPath = line.substring(8).trim();
      } else if (line.startsWith('@props:')) {
        currentSection = 'props';
        component.props = [];
      } else if (line.startsWith('@examples:')) {
        currentSection = 'examples';
        component.examples = [];
      } else if (line.startsWith('@related:')) {
        component.relatedComponents = line.substring(9).split(',').map(c => c.trim());
      } else if (line.startsWith('- ') && currentSection === 'props') {
        const propMatch = line.match(/- (\\w+)\\s*\\(([^)]+)\\)\\s*:?\\s*(.*)/);
        if (propMatch) {
          component.props = component.props || [];
          component.props.push({
            name: propMatch[1],
            type: propMatch[2],
            required: !propMatch[2].includes('?'),
            description: propMatch[3]
          });
        }
      } else if (line.startsWith('- ') && currentSection === 'examples') {
        const exampleMatch = line.match(/- ([^:]+):\\s*(.*)/);
        if (exampleMatch) {
          component.examples = component.examples || [];
          component.examples.push({
            title: exampleMatch[1].trim(),
            code: exampleMatch[2].trim()
          });
        }
      }
    }
    
    return component;
  }
  
  private extractManualEntries(content: string, filePath: string, context: ParseContext): ComponentAnalysis | null {
    // Look for manual component definitions or exports
    const componentName = this.extractComponentNameFromFile(filePath);
    
    // Look for JSDoc comments above component exports
    const jsdocMatch = content.match(new RegExp(`/\\*\\*([\\s\\S]*?)\\*/\\s*export\\s+(?:default\\s+)?(?:const\\s+|function\\s+|class\\s+)?${componentName}`));
    
    if (jsdocMatch) {
      const jsdocContent = jsdocMatch[1];
      const description = this.extractDescriptionFromJSDoc(jsdocContent);
      
      if (description) {
        return {
          name: componentName,
          description,
          customData: {
            comments: {
              source: 'jsdoc',
              filePath,
              manual: false
            }
          }
        };
      }
    }
    
    return null;
  }
  
  private extractDescriptionFromJSDoc(jsdoc: string): string {
    // Remove JSDoc syntax and extract description
    const cleaned = jsdoc.replace(/\\*\\s*/g, '').trim();
    const lines = cleaned.split('\\n');
    const descriptionLines = [];
    
    for (const line of lines) {
      if (line.startsWith('@')) break; // Stop at first JSDoc tag
      if (line.trim()) {
        descriptionLines.push(line.trim());
      }
    }
    
    return descriptionLines.join(' ');
  }
  
  private extractComponentNameFromFile(filePath: string): string {
    const fileName = filePath.split('/').pop()?.replace(/\\.(tsx?|jsx?)$/, '') || 'Unknown';
    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }
  
  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        includeJSDoc: {
          type: 'boolean',
          description: 'Include JSDoc comments as manual entries',
          default: true
        },
        strictParsing: {
          type: 'boolean',
          description: 'Fail on malformed @dsm blocks instead of skipping',
          default: false
        },
        inferComponentPath: {
          type: 'boolean',
          description: 'Try to infer component file path from story file',
          default: true
        }
      }
    };
  }
}