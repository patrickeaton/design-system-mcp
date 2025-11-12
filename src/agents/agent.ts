import OpenAI from "openai";
import { AgentTool } from "./agent-tool";
import { MemoryStorage } from "./memory-storage";
import { Message } from "./models";

const DEFAULT_CONFIG: Omit<
  OpenAI.ChatCompletionCreateParamsNonStreaming,
  "messages" | "tools"
> = {
  model: "gpt-4o-mini",
  max_tokens: 1000,
};

type MessageContextSettings = {
  includeMessageHistory?: boolean;
  messagingHistoryStartDate?: Date;
  includeProjectSummary?: boolean;
  includeAgentSummaries?: boolean;
  includeAgentFeedback?: boolean;
  addtionalContext?: OpenAI.ChatCompletionMessageParam[];
};

export class Agent {
  private openAI: OpenAI;
  private accountId: string;
  private projectId: string;
  private prompt: string;
  private tools: AgentTool[];
  private storage: MemoryStorage | null;
  private config: Omit<
    OpenAI.ChatCompletionCreateParamsNonStreaming,
    "messages"
  >;

  constructor({
    accountId,
    projectId,
    prompt,
    tools = [],
    storage = null,
    config = {},
  }: {
    accountId: string;
    projectId: string;
    prompt: string;
    tools?: AgentTool[];
    storage?: MemoryStorage | null;
    config?: Partial<
      Omit<OpenAI.ChatCompletionCreateParamsNonStreaming, "messages" | "tools">
    >;
  }) {
    this.openAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
    });

    this.accountId = accountId;
    this.projectId = projectId;
    this.prompt = prompt;
    this.tools = tools;
    this.storage = storage;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public addTool(tool: AgentTool): void {
    this.tools.push(tool);
  }

  public addInstructions(prompt: string): void {
    this.prompt += `\n${prompt}`;
  }

  private async processMessage(
    message: OpenAI.ChatCompletionCreateParamsNonStreaming,
    tokens = 0,
    actions: string[] = [],
    depth = 0
  ): Promise<{
    answer: OpenAI.ChatCompletionMessageParam;
    tokens: number;
    actions: string[];
  }> {
    console.log("Processing message", message.messages.length, "depth", depth);
    
    // Prevent infinite loops by limiting depth
    const MAX_DEPTH = 5;
    if (depth >= MAX_DEPTH) {
      console.log("Max depth reached, stopping tool calls");
      return {
        answer: {
          role: "assistant",
          content: "Maximum processing depth reached. Please try a simpler request."
        },
        actions,
        tokens
      };
    }

    const res = await this.openAI.chat.completions.create(message);
    const answer = res.choices[0].message;

    console.log("Received answer", answer);

    // No tools, pretty simple.
    if (!answer?.tool_calls) {
      return {
        answer,
        actions,
        tokens: tokens + (res?.usage?.total_tokens ?? 0),
      };
    }

    const messages = message.messages;
    // Add the answer to the messages
    messages.push(answer);

    // Build a map of tools
    const tools = this.tools.reduce((acc, tool) => {
      acc[tool.getName()] = tool;
      return acc;
    }, {} as { [toolName: string]: AgentTool });

    const messageActions: string[] = [...actions];

    // Process each tool call
    const toolResponses = await Promise.all(
      answer.tool_calls.map(async (toolCall) => {
        const { id } = toolCall;
        const name = (toolCall as any).function?.name;
        const args = (toolCall as any).function?.arguments;
        if (!tools[name]) throw new Error(`No handler for tool ${name}`);

        const { actions: toolActions, ...res } = await tools[name].handle(
          id,
          args,
          {
            accountId: this.accountId,
            projectId: this.projectId,
          }
        );

        // Add the actions to the message
        if (toolActions?.length)
          messageActions.push(
            ...toolActions.filter((a) => !messageActions.includes(a))
          );

        return res;
      })
    );

    messages.push(...toolResponses);

    // Recursively process with incremented depth to prevent infinite loops
    return this.processMessage(
      {
        ...message,
        messages,
        tool_choice: "none", // This is to stop it running the tools again
      },
      tokens + (res?.usage?.total_tokens ?? 0), // Add the tokens used by the tool
      messageActions,
      depth + 1
    );
  }

  public async sendMessage(
    userId: string,
    content: string,
    settings: MessageContextSettings = {}
  ): Promise<Message | string | null> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: this.prompt,
      },
    ];

    if (this.storage) {
      if (settings.includeProjectSummary) {
        const summary = await this.storage.getProjectSummary();
        messages.push(summary);
      }

      if (settings.includeAgentFeedback) {
        const feedback = await this.storage.getAgentFeedback();
        messages.push(...feedback);
      }

      if (settings.includeAgentSummaries) {
        const summaries = await this.storage.getAgentSummaries();
        messages.push(...summaries);
      }

      if (settings.includeMessageHistory) {
        const history = await this.storage.loadMessages(
          settings.messagingHistoryStartDate
        );
        messages.push(...history);
      }

      // Save the user message
      await this.storage.saveMessage(
        {
          role: "user",
          content,
        },
        0,
        [],
        userId
      );
    }

    if (settings?.addtionalContext?.length)
      messages.push(...settings.addtionalContext);

    messages.push({
      role: "user",
      content,
    });

    const { answer, tokens, actions } = await this.processMessage({
      ...this.config,
      tools: this.tools.map((tool) => tool.getToolConfig()),
      messages,
    });

    if (this.storage) {
      return this.storage.saveMessage(answer, tokens, actions);
    }

    return answer.content as string;
  }
}
