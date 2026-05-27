import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, PlusSquare, SlidersHorizontal, ArrowUp, Trash2,
  Copy, Check, X, Cpu, ToggleLeft, ToggleRight, Download,
  Brain, ChevronLeft, ChevronRight, Command
} from 'lucide-react';

import { MemoryService } from './memory';
import TypewriterContent from './TypewriterContent';
import LandingPage from './LandingPage';
import CommandPalette from './CommandPalette';
import MemoryPanel from './MemoryPanel';
import { MODE_CONFIG, buildPrompt } from './config';
import type { InferenceMode, Message } from './config';

function App() {
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('lhai_onboarded') === 'true');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<InferenceMode>('Quick');
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState(0);
  const [lastCharCount, setLastCharCount] = useState(0);
  const [sidebarTab, setSidebarTab] = useState(0);
  const [animatedMsgs, setAnimatedMsgs] = useState<Set<number>>(new Set());

  // Collapsible sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // Memory Panel state
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);

  // Simulated live telemetry
  const [telemetry, setTelemetry] = useState({
    tSpeed: 12.4,
    vram: 6.2,
    cpu: 22
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on chat updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Listen for Ctrl+K command palette trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fluctuating live telemetry simulator
  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetry(prev => {
        const speedOffset = (Math.random() - 0.5) * 0.8;
        const vramOffset = (Math.random() - 0.5) * 0.1;
        const cpuOffset = (Math.random() - 0.5) * 4;

        return {
          tSpeed: Math.max(8.0, Math.min(18.0, Number((prev.tSpeed + speedOffset).toFixed(1)))),
          vram: Math.max(4.0, Math.min(7.9, Number((prev.vram + vramOffset).toFixed(1)))),
          cpu: Math.max(10, Math.min(85, Math.round(prev.cpu + cpuOffset)))
        };
      });
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  // ── LANDING PAGE GUARD ──
  if (!onboarded) {
    return (
      <LandingPage
        onEnter={() => {
          localStorage.setItem('lhai_onboarded', 'true');
          setOnboarded(true);
        }}
      />
    );
  }

  // ── SEND ──
  const sendPrompt = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    if (memoryEnabled) MemoryService.addMessage('user', text);

    const memoryText = memoryEnabled
      ? MemoryService.getRecent(6).map(m => `- ${m.role}: ${m.content}`).join('\n')
      : 'Memory disabled or empty.';
    const prompt = buildPrompt(text, mode, memoryEnabled, memoryText);
    const config = MODE_CONFIG[mode];
    const start = Date.now();

    abortControllerRef.current = new AbortController();

    if (streamingEnabled) {
      await streamResponse(prompt, config, start);
    } else {
      await instantResponse(prompt, config, start);
    }
  }, [input, loading, mode, streamingEnabled, memoryEnabled]);

  // ── STOP GENERATION ──
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: last.content + ' [Generation interrupted]'
          };
        }
        return updated;
      });
    }
  };

  // ── INSTANT RESPONSE ──
  const instantResponse = async (
    prompt: string,
    config: typeof MODE_CONFIG['Quick'],
    start: number
  ) => {
    try {
      const res = await fetch('http://127.0.0.1:8080/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          prompt,
          n_predict: config.tokens,
          temperature: config.temperature,
          stop: ['<|eot_id|>', '<|start_header_id|>', 'User:', 'Assistant:'],
          stream: false,
        }),
      });
      const data = await res.json();
      const reply = (data.content ?? '').trim();
      const latency = Date.now() - start;

      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now(), latencyMs: latency }]);
      setLastLatencyMs(latency);
      setLastCharCount(reply.length);
      if (memoryEnabled) MemoryService.addMessage('assistant', reply);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Could not reach local LLM at `127.0.0.1:8080`. Ensure llama.cpp server is running.', timestamp: Date.now() }]);
      }
    }
    setLoading(false);
  };

  // ── STREAMING RESPONSE ──
  const streamResponse = async (
    prompt: string,
    config: typeof MODE_CONFIG['Quick'],
    start: number
  ) => {
    try {
      const res = await fetch('http://127.0.0.1:8080/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          prompt,
          n_predict: config.tokens,
          temperature: config.temperature,
          stop: ['<|eot_id|>', '<|start_header_id|>', 'User:', 'Assistant:'],
          stream: true,
        }),
      });

      const assistantMsg: Message = { role: 'assistant', content: '', timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      setAnimatedMsgs(prev => new Set(prev).add(assistantMsg.timestamp));
      const msgIdx = messages.length + 1;

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data:')) continue;
            if (line.includes('[DONE]')) break;
            try {
              const parsed = JSON.parse(line.replace('data:', '').trim());
              const token = parsed.content ?? '';
              fullText += token;
              setMessages(prev => {
                const updated = [...prev];
                if (updated[msgIdx]) updated[msgIdx] = { ...updated[msgIdx], content: fullText };
                return updated;
              });
            } catch { /* skip malformed */ }
          }
        }
      }

      const latency = Date.now() - start;
      setMessages(prev => {
        const updated = [...prev];
        if (updated[msgIdx]) updated[msgIdx] = { ...updated[msgIdx], latencyMs: latency };
        return updated;
      });
      setLastLatencyMs(latency);
      setLastCharCount(fullText.length);
      if (memoryEnabled) MemoryService.addMessage('assistant', fullText.trim());
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Stream failed. Ensure llama.cpp is running.', timestamp: Date.now() }]);
      }
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(); }
  };

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const newChat = () => { setMessages([]); setLastLatencyMs(0); setLastCharCount(0); setAnimatedMsgs(new Set()); };
  const clearMemory = () => { MemoryService.clear(); };

  const exportChat = () => {
    if (messages.length === 0) return;
    let mdContent = `# LocalHost-AI Chat Export\n`;
    mdContent += `*Exported on: ${new Date().toLocaleString()}*\n`;
    mdContent += `*Mode: ${mode} (Tokens: ${MODE_CONFIG[mode].tokens}, Temp: ${MODE_CONFIG[mode].temperature})*\n\n`;
    mdContent += `---\n\n`;
    messages.forEach((msg) => {
      const roleName = msg.role === 'user' ? '### 👤 User' : '### 🤖 Assistant';
      mdContent += `${roleName}\n\n${msg.content}\n\n`;
      if (msg.latencyMs) {
        mdContent += `*Latency: ${msg.latencyMs}ms*\n\n`;
      }
      mdContent += `*Timestamp: ${new Date(msg.timestamp).toLocaleTimeString()}*\n\n`;
      mdContent += `---\n\n`;
    });
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `localhost-ai-chat-${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modeConfig = MODE_CONFIG[mode];

  // Quick Preset Prompts
  const quickPresets = [
    { text: 'Explain microservices architecture simply.', label: 'Microservices' },
    { text: 'Write a typescript React component wrapper.', label: 'React Wrapper' },
    { text: 'Analyze this algorithm for memory bottlenecks.', label: 'Bottlenecks' },
  ];

  return (
    <div className="flex h-screen bg-[#090b0a] text-white font-sans overflow-hidden select-none">
      
      {/* Raycast Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        setMode={setMode}
        setStreamingEnabled={setStreamingEnabled}
        setMemoryEnabled={setMemoryEnabled}
        streamingEnabled={streamingEnabled}
        memoryEnabled={memoryEnabled}
        newChat={newChat}
        clearMemory={clearMemory}
        setShowSettings={setShowSettings}
        exportChat={exportChat}
      />

      {/* Memory Vault Panel */}
      <MemoryPanel
        isOpen={memoryPanelOpen}
        onClose={() => setMemoryPanelOpen(false)}
      />

      {/* ═══ SIDEBAR ═══ */}
      <motion.div
        animate={{ width: sidebarCollapsed ? 76 : 280 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="bg-[#121513] border-r border-[#222e26]/60 flex flex-col shrink-0 z-10 relative"
      >
        {/* Toggle Collapse Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-8 bg-[#121513] border border-[#222e26]/60 hover:border-[#3bf185]/40 text-white/50 hover:text-white p-1 rounded-full z-20 cursor-pointer shadow-lg active:scale-90 transition-all duration-200"
        >
          {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Brand Header */}
        <div className="px-5 pt-8 pb-6 overflow-hidden">
          <motion.div layout className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3bf185]/10 border border-[#3bf185]/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(59,241,133,0.05)]">
              <Cpu size={18} className="text-[#3bf185]" />
            </div>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-[15px] font-bold tracking-tight text-white leading-none">LocalHost-AI</h1>
                <p className="text-[9px] tracking-[0.15em] font-mono text-[#3bf185]/40 mt-1 uppercase">Offline OS</p>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Navigation List */}
        <nav className="flex flex-col gap-1 px-2.5">
          {[
            { icon: <Terminal size={17} />, label: 'Workspace', idx: 0, action: () => setSidebarTab(0) },
            { icon: <PlusSquare size={17} />, label: 'New Session', idx: 1, action: () => { newChat(); setSidebarTab(0); } },
            { icon: <Brain size={17} />, label: 'Memory Vault', idx: 3, action: () => setMemoryPanelOpen(true) },
            { icon: <SlidersHorizontal size={17} />, label: 'Parameters', idx: 2, action: () => setShowSettings(true) },
          ].map(item => {
            const isSelected = sidebarTab === item.idx;
            return (
              <button
                key={item.idx}
                onClick={item.action}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all duration-200 group relative border border-transparent ${
                  isSelected
                    ? 'bg-[#3bf185]/10 border-[#3bf185]/20 text-[#3bf185] shadow-[0_0_15px_rgba(59,241,133,0.05)]'
                    : 'text-white/60 hover:bg-white/3 hover:text-white'
                }`}
              >
                <span className={`shrink-0 transition-transform duration-200 group-hover:scale-108 ${isSelected ? 'text-[#3bf185]' : ''}`}>
                  {item.icon}
                </span>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-sans text-[12.5px] font-medium tracking-wide"
                  >
                    {item.label}
                  </motion.span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Mode Selector */}
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-5 mt-8 overflow-hidden"
          >
            <p className="font-mono text-[9px] text-white/30 tracking-widest mb-3 uppercase">Inference Mode</p>
            <div className="space-y-1.5">
              {(['Quick', 'Reasoning', 'Writing'] as InferenceMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 relative ${
                    mode === m
                      ? 'bg-[#3bf185]/10 border-[#3bf185]/25 text-[#3bf185] shadow-[0_0_15px_rgba(59,241,133,0.03)]'
                      : 'border-transparent text-white/50 hover:bg-white/3 hover:text-white/80'
                  }`}
                >
                  <span className="shrink-0">{MODE_CONFIG[m].icon}</span>
                  <div className="text-left overflow-hidden">
                    <p className="text-[12.5px] font-semibold leading-tight">{m}</p>
                    <p className="text-[9.5px] opacity-60 truncate mt-0.5">{MODE_CONFIG[m].description}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Sidebar Toggles */}
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-5 mt-7 space-y-2.5 overflow-hidden"
          >
            <p className="font-mono text-[9px] text-white/30 tracking-widest mb-1.5 uppercase">Toggle Pool</p>
            <ToggleRow label="Streaming" value={streamingEnabled} onChange={setStreamingEnabled} />
            <ToggleRow label="Context Memory" value={memoryEnabled} onChange={setMemoryEnabled} />
          </motion.div>
        )}

        <div className="mt-auto" />

        {/* Live Telemetry monitor panel */}
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-5 py-4 mx-3 mb-2 rounded-xl bg-white/2 border border-[#222e26]/30 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[8px] text-[#3bf185]/50 tracking-widest uppercase">Live Telemetry</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#3bf185] animate-ping" />
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="bg-white/2 p-1.5 rounded-lg border border-[#222e26]/20">
                <span className="block text-[8px] text-white/30 font-mono">VRAM</span>
                <span className="text-[10px] font-bold font-mono text-[#3bf185]">{telemetry.vram}G</span>
              </div>
              <div className="bg-white/2 p-1.5 rounded-lg border border-[#222e26]/20">
                <span className="block text-[8px] text-white/30 font-mono">CPU</span>
                <span className="text-[10px] font-bold font-mono text-[#3bf185]">{telemetry.cpu}%</span>
              </div>
              <div className="bg-white/2 p-1.5 rounded-lg border border-[#222e26]/20">
                <span className="block text-[8px] text-white/30 font-mono">SPEED</span>
                <span className="text-[10px] font-bold font-mono text-[#3bf185]">{telemetry.tSpeed}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Sidebar Connection Status Bottom */}
        <div className="px-5 py-5 border-t border-[#222e26]/40 bg-[#0f1110]">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} transition-all`}>
            <motion.div
              animate={{
                scale: loading ? [1, 1.3, 1] : 1,
                boxShadow: loading
                  ? ['0 0 4px #3bf185', '0 0 16px #3bf185', '0 0 4px #3bf185']
                  : '0 0 0px transparent'
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${loading ? 'bg-[#3bf185]' : 'bg-[#3bf185]/35'}`}
            />
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <span className={`block font-mono text-[10px] font-bold tracking-wider ${loading ? 'text-[#3bf185]' : 'text-[#3bf185]/60'}`}>
                  {loading ? 'GENERATING...' : 'ONLINE LOCAL'}
                </span>
                <span className="block text-[8px] font-mono text-white/20 mt-0.5">Port 8080 Active</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ═══ MAIN WORKSPACE ═══ */}
      <div className="flex-1 flex flex-col relative bg-[#0b0d0c]">
        
        {/* Header */}
        <header className="h-16 px-8 flex items-center justify-between shrink-0 border-b border-[#222e26]/30 bg-[#0f1110]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <span className="text-[#3bf185]">{modeConfig.icon}</span>
            <h2 className="text-[15px] font-bold tracking-tight text-white">{mode} Engine</h2>
            <span className="text-[11px] text-[#3bf185]/40 font-mono">· {modeConfig.tokens} max tokens · t={modeConfig.temperature}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Command Palette Keyboard Indicator Button */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white/3 border border-white/5 hover:border-[#3bf185]/30 rounded-lg text-white/40 hover:text-white font-mono text-[10.5px] transition-all cursor-pointer shadow-inner active:scale-95"
            >
              <Command size={11} /> <span>K</span>
            </button>

            <AnimatePresence>
              {!loading && lastLatencyMs > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-3 py-1.5 bg-white/2 border border-white/5 rounded-xl font-mono text-[10.5px] text-[#3bf185]/80 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3bf185]" />
                  <span>{lastLatencyMs}ms</span>
                  <span className="opacity-45">·</span>
                  <span>{lastCharCount} chars</span>
                </motion.div>
              )}
            </AnimatePresence>

            {messages.length > 0 && (
              <button
                onClick={exportChat}
                className="p-2 text-white/40 hover:text-[#3bf185] hover:bg-white/3 rounded-lg transition-all"
                title="Export chat (Markdown)"
              >
                <Download size={17} />
              </button>
            )}
            <button
              onClick={newChat}
              className="p-2 text-white/40 hover:text-red-400 hover:bg-white/3 rounded-lg transition-all"
              title="Clear chat session"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </header>

        {/* Chat History Container */}
        <div className="flex-1 overflow-y-auto px-8 pb-40 scrollbar-thin">
          <div className="max-w-[840px] mx-auto flex flex-col gap-6 pt-6">

            {/* Empty workspace state */}
            {messages.length === 0 && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center pt-28 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#3bf185]/5 border border-[#3bf185]/10 flex items-center justify-center mb-6 shadow-inner animate-pulse">
                  <Cpu size={32} className="text-[#3bf185]/40" />
                </div>
                <h3 className="text-[17px] font-bold text-white/80 mb-2 font-sans tracking-tight">Offline AI Workspace</h3>
                <p className="text-white/40 text-xs max-w-sm leading-relaxed mb-6">
                  Running entirely on your physical hardware. Direct interface with local llama-server node on port <code className="text-[#3bf185] font-mono text-[11px] bg-[#3bf185]/10 px-1 rounded">8080</code>.
                </p>

                {/* Preset prompt grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-[680px]">
                  {quickPresets.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInput(p.text)}
                      className="preset-card text-left p-4 rounded-xl border border-white/5 bg-white/2 hover:bg-[#3bf185]/5 transition-all text-xs cursor-pointer active:scale-98"
                    >
                      <div className="text-[#3bf185] font-semibold font-sans mb-1">{p.label}</div>
                      <div className="text-white/40 leading-relaxed font-sans line-clamp-2">{p.text}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Messages View */}
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: isUser ? 20 : -20, y: 10 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}
                  >
                    <div className={`relative max-w-[85%] rounded-2xl border transition-all duration-300 ${
                      isUser
                        ? 'border-[#222e26]/80 bg-[#181c19]/60 px-5 py-4 text-white shadow-[0_4px_16px_rgba(0,0,0,0.15)]'
                        : 'border-[#2b382f]/30 bg-[#1e2320]/30 px-5 py-4 text-white/90 shadow-inner'
                    }`}>

                      {/* Copy message button (for Assistant) */}
                      {!isUser && msg.content && (
                        <button
                          onClick={() => copyText(msg.content, idx)}
                          className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white cursor-pointer"
                        >
                          {copiedIdx === idx ? <Check size={13} className="text-[#3bf185]" /> : <Copy size={13} />}
                        </button>
                      )}

                      {/* Content Render */}
                      {isUser ? (
                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap font-sans">{msg.content}</p>
                      ) : (
                        <TypewriterContent
                          text={msg.content || '...'}
                          animate={!animatedMsgs.has(msg.timestamp)}
                          onComplete={() => setAnimatedMsgs(prev => new Set(prev).add(msg.timestamp))}
                        />
                      )}

                      {/* Latency statistics for message */}
                      {!isUser && msg.latencyMs && (
                        <div className="mt-3.5 pt-2.5 border-t border-[#222e26]/30 flex items-center justify-between text-[10px] font-mono text-[#3bf185]/40">
                          <span>Inference Latency</span>
                          <span>⚡ {msg.latencyMs}ms</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Premium Loading Skeleton Shimmer State */}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start w-full max-w-[85%]"
              >
                <div className="w-full bg-[#1e2320]/30 border border-[#2b382f]/30 rounded-2xl px-5 py-5 shadow-inner shimmer-placeholder">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3bf185] animate-ping" />
                    <span className="font-mono text-[9px] text-[#3bf185]/60 uppercase tracking-widest font-bold">Connecting Local Core</span>
                  </div>
                  {/* Glowing skeleton rows */}
                  <div className="space-y-2.5">
                    <div className="h-3 w-[85%] rounded bg-white/5" />
                    <div className="h-3 w-[95%] rounded bg-white/5" />
                    <div className="h-3 w-[60%] rounded bg-white/5" />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} className="h-4" />
          </div>
        </div>

        {/* ═══ INPUT DOCK ═══ */}
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="absolute bottom-6 left-8 right-8 flex justify-center pointer-events-none z-10"
        >
          <div className="w-full max-w-[840px] bg-[#121413]/85 backdrop-blur-md border border-[#222e26]/60 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.6)] pointer-events-auto transition-all focus-within:border-[#3bf185]/35 focus-within:shadow-[0_12px_45px_rgba(59,241,133,0.03)]">
            <div className="flex items-end p-2.5">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter prompt to query Llama-3 local model..."
                rows={1}
                className="flex-1 bg-transparent text-white placeholder-white/20 p-4 resize-none outline-none max-h-48 min-h-[56px] text-[14.5px] font-sans"
              />
              
              {/* Dynamic Action Button: Sends on input, stops when generating */}
              {loading ? (
                <button
                  onClick={stopGeneration}
                  className="p-3.5 m-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-lg animate-pulse"
                  title="Abort generation"
                >
                  <X size={18} />
                </button>
              ) : (
                <button
                  onClick={sendPrompt}
                  disabled={!input.trim()}
                  className={`p-3.5 m-1 rounded-xl transition-all duration-300 cursor-pointer shadow-lg ${
                    !input.trim()
                      ? 'bg-white/2 text-white/10 cursor-not-allowed border border-white/5'
                      : 'bg-[#3bf185] text-[#0a2f1a] font-bold hover:bg-[#2fe578] hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(59,241,133,0.3)]'
                  }`}
                  title="Send message"
                >
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
            
            <div className="flex items-center justify-between px-5 pb-3.5 text-white/25">
              <span className="font-mono text-[9.5px] uppercase tracking-wider">
                {mode} Mode · {streamingEnabled ? 'Stream' : 'Instant'} · {memoryEnabled ? 'Memory Active' : 'No Context'}
              </span>
              <span className="font-mono text-[9.5px]">
                {input.length} chars
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══ SETTINGS OVERLAY ═══ */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#000000bd] backdrop-blur-[6px] z-50 flex items-center justify-center"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="bg-[#121413] border border-[#2b3530] rounded-2xl w-[480px] max-h-[85vh] overflow-y-auto p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-[16px] font-bold tracking-tight">Workspace Config</h2>
                  <p className="text-[9px] text-[#3bf185]/50 font-mono uppercase tracking-widest mt-0.5">Parameters Overlay</p>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-white/50 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="font-mono text-[9px] text-[#3bf185]/40 tracking-widest mb-3 uppercase">Inference Settings</p>
                  {(['Quick', 'Reasoning', 'Writing'] as InferenceMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl mb-2.5 transition-all border ${
                        mode === m
                          ? 'bg-[#3bf185]/10 border-[#3bf185]/25 text-[#3bf185] shadow-[0_0_15px_rgba(59,241,133,0.03)]'
                          : 'border-transparent text-white/50 hover:bg-white/3'
                      }`}
                    >
                      {MODE_CONFIG[m].icon}
                      <div className="text-left">
                        <p className="text-sm font-semibold">{m}</p>
                        <p className="text-[11px] opacity-50 mt-0.5">{MODE_CONFIG[m].description} · {MODE_CONFIG[m].tokens} tokens · temp {MODE_CONFIG[m].temperature}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div>
                  <p className="font-mono text-[9px] text-[#3bf185]/40 tracking-widest mb-3 uppercase">Feature Switches</p>
                  <div className="space-y-1">
                    <ToggleRow label="Streaming responses" value={streamingEnabled} onChange={setStreamingEnabled} />
                    <ToggleRow label="Contextual memory storage" value={memoryEnabled} onChange={setMemoryEnabled} />
                  </div>
                </div>

                <div>
                  <p className="font-mono text-[9px] text-[#3bf185]/40 tracking-widest mb-3 uppercase">Local Memory Storage</p>
                  <button
                    onClick={() => { clearMemory(); setShowSettings(false); }}
                    className="w-full py-3.5 rounded-xl text-xs font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/10 active:scale-98 transition-all duration-200"
                  >
                    Purge Context Memory Vault
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="w-full mt-8 py-3.5 rounded-xl bg-[#3bf185] text-[#0a2f1a] font-bold text-xs hover:bg-[#2fe578] active:scale-95 transition-all duration-200 shadow-md"
              >
                Save parameters
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── TOGGLE ROW ──
function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-white/3 transition-colors duration-150 text-left cursor-pointer"
    >
      <span className="text-[13px] text-white/80 font-sans">{label}</span>
      {value
        ? <ToggleRight size={22} className="text-[#3bf185]" />
        : <ToggleLeft size={22} className="text-white/25" />
      }
    </button>
  );
}

export default App;
