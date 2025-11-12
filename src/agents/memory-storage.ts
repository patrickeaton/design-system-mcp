import OpenAI from 'openai';
import { Message } from './models';

/**
 * Simple in-memory message storage for development/testing
 */
export class MemoryStorage {
  private messages: Message[] = [];
  private accountId: string;
  private projectId: string;
  private writeAgent: string;
  private readAgent: string | null;

  constructor({
    accountId,
    projectId,
    writeAgent,
    readAgent = null,
  }: {
    accountId: string;
    projectId: string;
    writeAgent: string;
    readAgent?: string | null;
  }) {
    this.accountId = accountId;
    this.projectId = projectId;
    this.readAgent = readAgent;
    this.writeAgent = writeAgent;
  }

  public async saveMessage(
    messageParam: OpenAI.ChatCompletionMessageParam,
    tokens: number = 0,
    actions: string[] = [],
    userId?: string,
  ): Promise<Message> {
    const { content, role } = messageParam;
    const toolCalls =
      'tool_calls' in messageParam ? messageParam.tool_calls : [];

    const message: Message = {
      accountId: this.accountId,
      projectId: this.projectId,
      agent: this.writeAgent,
      content: content as string,
      role: role as 'assistant' | 'user',
      userId: userId || 'anonymous',
      timestamp: Date.now(),
      toolCalls: toolCalls || [],
      tokens,
    };

    this.messages.push(message);
    return message;
  }

  public async getProjectSummary(): Promise<OpenAI.ChatCompletionMessageParam> {
    return {
      role: 'system',
      content: 'Project summary: Design system MCP generation tool',
    };
  }

  public async getAgentFeedback(): Promise<
    OpenAI.ChatCompletionMessageParam[]
  > {
    return [];
  }

  public async getAgentSummaries(): Promise<
    OpenAI.ChatCompletionMessageParam[]
  > {
    return [];
  }

  public async loadMessages(
    startDate?: Date,
  ): Promise<OpenAI.ChatCompletionMessageParam[]> {
    let filteredMessages = this.messages;

    if (startDate) {
      const startTimestamp = startDate.getTime();
      filteredMessages = this.messages.filter(
        (msg) => msg.timestamp >= startTimestamp,
      );
    }

    return filteredMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  public getMessages(): Message[] {
    return [...this.messages];
  }

  public clearMessages(): void {
    this.messages = [];
  }
}
