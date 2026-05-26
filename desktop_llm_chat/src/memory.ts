const MEMORY_KEY = 'localhost_ai_memory';

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
    memory.push({ role, content });
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
