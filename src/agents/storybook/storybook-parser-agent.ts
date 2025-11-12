import { Agent } from '../agent';
import { ComponentAnalyzerTool } from '../tools/component-analyzer-tool';
import { MemoryStorage } from '../memory-storage';

/**
 * Specialized agent for parsing Storybook files and generating component context
 */
export class StorybookParserAgent {
  private agent: Agent;
  private storage: MemoryStorage;

  constructor() {
    // Create memory storage for this agent
    this.storage = new MemoryStorage({
      accountId: 'design-system-mcp',
      projectId: 'storybook-parser',
      writeAgent: 'storybook-parser-agent',
    });

    // Create the agent with specialized prompt
    this.agent = new Agent({
      accountId: 'design-system-mcp',
      projectId: 'storybook-parser',
      prompt: `You are a specialized agent for analyzing components and generating comprehensive design system context.

Your role is to:
1. Use the component analyzer tool to extract detailed information from component and story files
2. Analyze props, slots, dependencies, related components, and accessibility features
3. Generate intelligent tags and categorization based on component behavior
4. Provide enhanced descriptions and usage guidance
5. Suggest improvements for component discoverability and documentation

IMPORTANT: Always start by using the analyze_component tool with the provided file paths. Use the analysis results to generate comprehensive, actionable insights about the component.

Focus on providing value beyond basic parsing - offer design system integration advice, usage patterns, and improvement suggestions.`,
      tools: [ComponentAnalyzerTool],
      storage: this.storage as any, // Type assertion for now
      config: {
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent parsing
      },
    });
  }

  /**
   * Parse a Storybook file and generate context
   */
  public async parseStorybookFile(
    storyFilePath: string,
    componentFilePath: string,
    framework: string = 'react',
    designLibrary: string = 'none',
    parsedComponents?: any[],
  ): Promise<string> {
    let contextInfo = '';
    if (parsedComponents && parsedComponents.length > 0) {
      contextInfo = `

Additional Context from parseStorybookFile:
${JSON.stringify(parsedComponents, null, 2)}

Use this as baseline context, but focus on using the analyze_component tool to get more detailed analysis.`;
    }

    const message = `Please analyze the component files and generate comprehensive design system context.

Story File: ${storyFilePath}
Component File: ${componentFilePath || 'Not specified - try to infer from story file'}
Framework: ${framework}
Design Library: ${designLibrary}${contextInfo}

INSTRUCTIONS:
1. Start by using the analyze_component tool to get detailed component information
2. Use the analysis results to provide enhanced insights and recommendations
3. Focus on design system integration, usage patterns, and developer experience
4. Suggest improvements for component discoverability and documentation

Generate a comprehensive analysis that will help developers understand and use this component effectively.`;

    const response = await this.agent.sendMessage('user', message, {
      includeMessageHistory: false,
    });

    return typeof response === 'string'
      ? response
      : response?.content || 'Failed to parse component';
  }

  /**
   * Get parsing insights and suggestions
   */
  public async getParsingInsights(
    storyFilePath: string,
    componentFilePath: string,
  ): Promise<string> {
    const message = `Analyze the Storybook file at "${storyFilePath}" and component file at "${componentFilePath}" and provide insights about:

1. Component structure and organization
2. Documentation quality and completeness
3. Story coverage and examples
4. Suggestions for improvement
5. Missing information that would be helpful for AI tools

Please provide actionable recommendations for improving the component's discoverability and usability.`;

    const response = await this.agent.sendMessage('user', message, {
      includeMessageHistory: true, // Include history for context
    });

    return typeof response === 'string'
      ? response
      : response?.content || 'Failed to analyze component';
  }

  /**
   * Batch process multiple Storybook files
   */
  public async parseMultipleFiles(
    files: Array<{
      storyPath: string;
      componentPath: string;
      framework?: string;
      designLibrary?: string;
    }>,
  ): Promise<Array<{ file: string; result: string; success: boolean }>> {
    const results = [];

    for (const file of files) {
      try {
        const result = await this.parseStorybookFile(
          file.storyPath,
          file.componentPath,
          file.framework || 'react',
          file.designLibrary || 'none',
        );

        results.push({
          file: file.storyPath,
          result,
          success: true,
        });
      } catch (error) {
        results.push({
          file: file.storyPath,
          result: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        });
      }
    }

    return results;
  }

  /**
   * Clear message history
   */
  public clearHistory(): void {
    this.storage.clearMessages();
  }

  /**
   * Get message history
   */
  public getHistory() {
    return this.storage.getMessages();
  }
}
