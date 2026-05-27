const MEMORY_KEY = 'localhost_ai_memory';
const MAX_ENTRY_LENGTH = 200; // Truncate long entries to save context tokens

export const MemoryService = {
  load(): { role: string; content: string }[] {
    try {
      const raw = localStorage.getItem(MEMORY_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch { return []; }
  },

  save(memory: { role: string; content: string }[]) {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  },

  addMessage(role: string, content: string) {
    const memory = this.load();
    // Store a summary for assistant messages to avoid flooding context with code blocks
    const stored = role === 'assistant' && content.length > MAX_ENTRY_LENGTH
      ? content.substring(0, MAX_ENTRY_LENGTH) + '... [truncated]'
      : content;
    memory.push({ role, content: stored });
    // Keep only the last 20 entries max
    if (memory.length > 20) {
      memory.splice(0, memory.length - 20);
    }
    this.save(memory);
  },

  getRecent(n: number) {
    const memory = this.load();
    return memory.slice(-n);
  },

  clear() {
    localStorage.setItem(MEMORY_KEY, '[]');
  }
};
