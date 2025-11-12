import OpenAI from 'openai';

export type Message = {
  accountId: string;
  projectId: string;
  agent: string;
  content: string;
  role: 'assistant' | 'user';
  userId: string;
  timestamp: number;
  toolCalls: OpenAI.ChatCompletionMessageToolCall[];
  tokens: number;
};
