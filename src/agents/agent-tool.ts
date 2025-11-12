import OpenAI from 'openai';

export type AgentToolConfig = {
  name: string;
  config: Omit<OpenAI.FunctionDefinition, 'name'>;
  handler: (
    id: string,
    params: string,
    config: {
      accountId: string;
      projectId: string;
    },
  ) => Promise<OpenAI.ChatCompletionToolMessageParam & { actions?: string[] }>;
  validate?: (params: string) => boolean;
};

export class AgentTool {
  private name: string;
  private config: Omit<OpenAI.FunctionDefinition, 'name'>;
  private handler: (
    id: string,
    params: string,
    config: {
      accountId: string;
      projectId: string;
    },
  ) => Promise<OpenAI.ChatCompletionToolMessageParam & { actions?: string[] }>;
  private validate: (params: string) => boolean;

  constructor({
    name,
    config,
    handler,
    validate = () => true,
  }: AgentToolConfig) {
    this.name = name;
    this.config = config;
    this.handler = handler;
    this.validate = validate;
  }

  public getToolConfig(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: this.name,
        ...this.config,
      },
    };
  }

  public getName(): string {
    return this.name;
  }

  public async handle(
    id: string,
    params: string, // JSON Encoded,
    config: {
      accountId: string;
      projectId: string;
    },
  ): Promise<OpenAI.ChatCompletionToolMessageParam & { actions?: string[] }> {
    if (!this.validate(params)) throw new Error('Invalid parameters');

    return this.handler(id, params, config);
  }
}
