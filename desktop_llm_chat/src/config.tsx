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
    tokens: 128,
    temperature: 0.7,
    icon: React.createElement(Zap, { size: 16 }),
    description: 'Fast, concise answers',
    instruction: 'Give a short, direct, concise answer.',
  },
  Reasoning: {
    tokens: 384,
    temperature: 0.5,
    icon: React.createElement(Brain, { size: 16 }),
    description: 'Step-by-step logic',
    instruction: 'Think step by step and explain your reasoning clearly.',
  },
  Writing: {
    tokens: 512,
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
  return `You are a fully offline personal AI assistant running locally.

Mode: ${mode}
Instruction: ${config.instruction}

Rules:
- Respond ONLY once
- Do NOT ask questions
- Do NOT include role labels
- Use Markdown only if useful

Memory Status: ${memoryEnabled ? 'ENABLED' : 'DISABLED'}

Private Memory:
${memoryText}

User Query:
${userInput}

A:
`;
}
