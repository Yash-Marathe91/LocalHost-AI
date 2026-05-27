import React from 'react';
import { Zap, Brain, Pen } from 'lucide-react';

export type InferenceMode = 'Quick' | 'Reasoning' | 'Writing';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  latencyMs?: number;
};

export const MODE_CONFIG: Record<InferenceMode, {
  tokens: number;
  temperature: number;
  icon: React.ReactNode;
  description: string;
  instruction: string;
}> = {
  Quick: {
    tokens: 512,
    temperature: 0.7,
    icon: React.createElement(Zap, { size: 16 }),
    description: 'Fast, concise answers',
    instruction: 'Give a short, direct, concise answer.',
  },
  Reasoning: {
    tokens: 1024,
    temperature: 0.5,
    icon: React.createElement(Brain, { size: 16 }),
    description: 'Step-by-step logic',
    instruction: 'Think step by step and explain your reasoning clearly.',
  },
  Writing: {
    tokens: 2048,
    temperature: 0.7,
    icon: React.createElement(Pen, { size: 16 }),
    description: 'Long-form, structured',
    instruction: 'Write a structured, well-formatted response using Markdown.',
  },
};

export function buildPrompt(
  userInput: string,
  mode: InferenceMode,
  memoryEnabled: boolean,
  memoryText: string
): string {
  const config = MODE_CONFIG[mode];

  const memoryBlock = memoryEnabled && memoryText && memoryText !== 'Memory disabled or empty.'
    ? `\nPrevious conversation context (for reference only — do NOT copy or repeat these):\n${memoryText}\n`
    : '';

  return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are a helpful offline AI assistant. ${config.instruction}

Critical rules:
- Give ONE fresh, original response to the user's latest message
- NEVER repeat or copy a previous response, even if the user asks the same question again
- NEVER include role labels like "User:" or "Assistant:" in your output
- If the user says "continue", expand on the last topic with NEW information
- Use Markdown formatting when helpful${memoryBlock}
<|eot_id|><|start_header_id|>user<|end_header_id|>

${userInput}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

`;
}
