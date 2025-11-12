import {
  ComponentParser,
  ParseContext,
  ParseResult,
  ComponentAnalysis,
} from '../parser-interface';
import { StorybookParserAgent } from '../../agents/storybook/storybook-parser-agent';

/**
 * Parser that uses OpenAI to provide enhanced component analysis
 */
export class OpenAIParser implements ComponentParser {
  readonly name = 'openai';
  readonly description =
    'Uses AI to provide enhanced component analysis, documentation suggestions, and best practices';

  private agent?: StorybookParserAgent;

  canParse(context: ParseContext): boolean {
    // Can parse if we have story file - API key will be checked during execution
    return !!context.storyFilePath;
  }

  async parse(context: ParseContext): Promise<ParseResult> {
    const startTime = Date.now();

    if (!this.agent) {
      this.agent = new StorybookParserAgent();
    }

    try {
      // Get previous storybook analysis if available
      const storybookResults = context.previousResults?.find(
        (r) => r.parser === 'storybook',
      );
      const previousComponents = storybookResults?.components || [];

      // Run AI analysis
      const aiAnalysis = await this.agent.parseStorybookFile(
        context.storyFilePath,
        context.componentFilePath || '',
        context.framework,
        context.designLibrary,
        previousComponents,
      );

      // Convert AI analysis to structured component data
      const components = await this.extractComponentsFromAIAnalysis(
        aiAnalysis,
        previousComponents,
        context,
      );

      const endTime = Date.now();

      return {
        parser: this.name,
        timestamp: new Date().toISOString(),
        components,
        metadata: {
          storyFile: context.storyFilePath,
          componentFile: context.componentFilePath,
          aiModel: 'gpt-4o-mini',
          executionTime: endTime - startTime,
          rawAnalysis: aiAnalysis,
        },
      };
    } catch (error) {
      throw new Error(
        `OpenAI parser failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async extractComponentsFromAIAnalysis(
    aiAnalysis: string,
    previousComponents: ComponentAnalysis[],
    context: ParseContext,
  ): Promise<ComponentAnalysis[]> {
    // If we have previous storybook results, enhance them with AI insights
    if (previousComponents.length > 0) {
      return previousComponents.map((comp) => ({
        ...comp,
        // Enhance description with AI insights
        description: this.enhanceDescription(comp.description, aiAnalysis),
        // Add AI-suggested tags
        tags: this.enhanceTags(comp.tags || [], aiAnalysis),
        // Add AI accessibility suggestions
        accessibility: [
          ...(comp.accessibility || []),
          ...this.extractAccessibilityFromAI(aiAnalysis),
        ],
        customData: {
          ...comp.customData,
          openai: {
            analysis: aiAnalysis,
            enhancedBy: 'gpt-4o-mini',
            suggestions: this.extractSuggestions(aiAnalysis),
            bestPractices: this.extractBestPractices(aiAnalysis),
          },
        },
      }));
    }

    // If no previous results, try to extract component info from AI analysis
    const componentName = this.extractComponentName(
      context.storyFilePath,
      aiAnalysis,
    );

    return [
      {
        name: componentName,
        description: this.extractDescription(aiAnalysis),
        category: this.extractCategory(aiAnalysis),
        tags: this.extractTags(aiAnalysis),
        customData: {
          openai: {
            analysis: aiAnalysis,
            extractedBy: 'gpt-4o-mini',
            suggestions: this.extractSuggestions(aiAnalysis),
            bestPractices: this.extractBestPractices(aiAnalysis),
          },
        },
      },
    ];
  }

  private enhanceDescription(originalDesc: string, aiAnalysis: string): string {
    // Look for enhanced descriptions in AI analysis
    const descMatch = aiAnalysis.match(/Description[:\-\s]*([^\n]+)/i);
    if (descMatch && descMatch[1].length > originalDesc.length) {
      return descMatch[1].trim();
    }
    return originalDesc;
  }

  private enhanceTags(originalTags: string[], aiAnalysis: string): string[] {
    const aiTags = this.extractTags(aiAnalysis);
    const combined = new Set([...originalTags, ...aiTags]);
    return Array.from(combined);
  }

  private extractAccessibilityFromAI(aiAnalysis: string): any[] {
    const accessibility = [];

    // Look for ARIA mentions
    const ariaMatches = aiAnalysis.match(/aria[- ]?[a-zA-Z]+/gi);
    if (ariaMatches) {
      ariaMatches.forEach((aria) => {
        accessibility.push({
          type: 'aria-label',
          value: aria,
          description: 'AI-suggested ARIA attribute',
        });
      });
    }

    // Look for keyboard support mentions
    if (aiAnalysis.toLowerCase().includes('keyboard')) {
      accessibility.push({
        type: 'keyboard-support',
        value: 'keyboard-navigation',
        description: 'AI-identified keyboard support requirement',
      });
    }

    return accessibility;
  }

  private extractSuggestions(aiAnalysis: string): string[] {
    const suggestions: string[] = [];

    // Look for suggestion patterns
    const suggestionPatterns = [
      /(?:suggest|recommend|consider)[\s:]+([^\n.]+)/gi,
      /(?:should|could|might)[\s]+([^\n.]+)/gi,
    ];

    suggestionPatterns.forEach((pattern) => {
      const matches = aiAnalysis.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          suggestions.push(match.trim());
        });
      }
    });

    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  }

  private extractBestPractices(aiAnalysis: string): string[] {
    const practices: string[] = [];

    // Look for best practice patterns
    const practicePatterns = [
      /best practice[s]?[\s:]+([^\n.]+)/gi,
      /(?:ensure|implement|use)[\s]+([^\n.]+)/gi,
    ];

    practicePatterns.forEach((pattern) => {
      const matches = aiAnalysis.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          practices.push(match.trim());
        });
      }
    });

    return practices.slice(0, 3); // Limit to top 3 practices
  }

  private extractComponentName(
    storyFilePath: string,
    aiAnalysis: string,
  ): string {
    // Try to extract from AI analysis first
    const nameMatch = aiAnalysis.match(
      /(?:Component|Name)[:\-\s]*([A-Z][a-zA-Z]+)/,
    );
    if (nameMatch) {
      return nameMatch[1];
    }

    // Fallback to filename
    const fileName =
      storyFilePath
        .split('/')
        .pop()
        ?.replace(/\.stories\.(tsx?|jsx?)$/, '') || 'Unknown';
    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }

  private extractDescription(aiAnalysis: string): string {
    const descMatch = aiAnalysis.match(
      /(?:Description|Overview)[:\-\s]*([^\n]+)/i,
    );
    return descMatch ? descMatch[1].trim() : 'AI-analyzed component';
  }

  private extractCategory(aiAnalysis: string): string {
    const categoryMatch = aiAnalysis.match(/(?:Category)[:\-\s]*([^\n]+)/i);
    if (categoryMatch) {
      return categoryMatch[1].trim().toLowerCase();
    }

    // Infer category from analysis content
    const content = aiAnalysis.toLowerCase();
    if (content.includes('button') || content.includes('action'))
      return 'actions';
    if (content.includes('input') || content.includes('form')) return 'forms';
    if (content.includes('modal') || content.includes('dialog'))
      return 'overlays';
    if (content.includes('layout') || content.includes('container'))
      return 'layout';

    return 'general';
  }

  private extractTags(aiAnalysis: string): string[] {
    const tags = new Set<string>();

    // Look for explicit tags
    const tagMatch = aiAnalysis.match(/(?:Tags?)[:\-\s]*([^\n]+)/i);
    if (tagMatch) {
      const tagText = tagMatch[1];
      const extractedTags = tagText.split(/[,\s]+/).filter((t) => t.length > 0);
      extractedTags.forEach((tag) =>
        tags.add(tag.toLowerCase().replace(/[^\w-]/g, '')),
      );
    }

    // Infer tags from content
    const content = aiAnalysis.toLowerCase();
    if (content.includes('interactive')) tags.add('interactive');
    if (content.includes('accessible')) tags.add('accessible');
    if (content.includes('customizable')) tags.add('customizable');
    if (content.includes('responsive')) tags.add('responsive');

    return Array.from(tags);
  }

  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'OpenAI model to use',
          default: 'gpt-4o-mini',
          enum: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
        },
        temperature: {
          type: 'number',
          description: 'Temperature for AI responses',
          default: 0.3,
          minimum: 0,
          maximum: 1,
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum tokens for AI response',
          default: 2000,
        },
        enhanceExisting: {
          type: 'boolean',
          description: 'Enhance existing component data rather than replace it',
          default: true,
        },
      },
    };
  }
}
