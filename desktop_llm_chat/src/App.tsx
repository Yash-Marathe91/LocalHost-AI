import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, PlusSquare, SlidersHorizontal, ArrowUp, Trash2,
  Copy, Check, X, Cpu, ToggleLeft, ToggleRight, Download
} from 'lucide-react';


import { MemoryService } from './memory';
import TypewriterContent from './TypewriterContent';
import { MODE_CONFIG, buildPrompt } from './config';
import type { InferenceMode, Message } from './config';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<InferenceMode>('Quick');
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState(0);
  const [lastCharCount, setLastCharCount] = useState(0);
  const [totalInferences, setTotalInferences] = useState(0);
  const [sidebarTab, setSidebarTab] = useState(0);
  const [animatedMsgs, setAnimatedMsgs] = useState<Set<number>>(new Set());

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => { inputRef.current?.focus(); }, []);

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

    if (streamingEnabled) {
      await streamResponse(prompt, config, start);
    } else {
      await instantResponse(prompt, config, start);
    }
  }, [input, loading, mode, streamingEnabled, memoryEnabled]);

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
      setTotalInferences(p => p + 1);
      if (memoryEnabled) MemoryService.addMessage('assistant', reply);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Could not reach local LLM at `127.0.0.1:8080`. Ensure llama.cpp server is running.', timestamp: Date.now() }]);
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
      setTotalInferences(p => p + 1);
      if (memoryEnabled) MemoryService.addMessage('assistant', fullText.trim());
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Stream failed. Ensure llama.cpp is running.', timestamp: Date.now() }]);
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

  // ── RENDER ──
  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white font-sans overflow-hidden select-none">

      {/* ═══ SIDEBAR ═══ */}
      <div className="w-[280px] bg-[#1A1A1A] border-r border-[#333] flex flex-col shrink-0 z-10">
        {/* Brand */}
        <div className="px-6 pt-8 pb-6">
          <h1 className="text-xl font-bold tracking-tight">LocalHost-AI</h1>
          <p className="text-[10px] tracking-[0.15em] font-mono text-white/40 mt-1">OFFLINE WORKSPACE</p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5">
          {[
            { icon: <Terminal size={18} />, label: 'Workspace', idx: 0, action: () => setSidebarTab(0) },
            { icon: <PlusSquare size={18} />, label: 'New Session', idx: 1, action: () => { newChat(); setSidebarTab(0); } },
            { icon: <SlidersHorizontal size={18} />, label: 'Parameters', idx: 2, action: () => setShowSettings(true) },
          ].map(item => (
            <button key={item.idx} onClick={item.action}
              className={`w-full flex items-center gap-4 px-6 py-3.5 border-l-[3px] transition-all duration-200
                ${sidebarTab === item.idx ? 'border-[#00E676] bg-[#00E676]/5 text-[#00E676]' : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white'}`}>
              {item.icon}
              <span className="font-mono text-[11px] tracking-widest font-semibold">{item.label.toUpperCase()}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar: Mode Selector */}
        <div className="px-6 mt-8">
          <p className="font-mono text-[10px] text-white/30 tracking-widest mb-3">INFERENCE MODE</p>
          {(['Quick', 'Reasoning', 'Writing'] as InferenceMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg mb-1.5 transition-all duration-200
                ${mode === m ? 'bg-[#00E676]/10 text-[#00E676] ring-1 ring-[#00E676]/30' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}>
              {MODE_CONFIG[m].icon}
              <div className="text-left">
                <p className="text-[13px] font-medium">{m}</p>
                <p className="text-[10px] opacity-60">{MODE_CONFIG[m].description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Sidebar: Toggles */}
        <div className="px-6 mt-6 space-y-3">
          <p className="font-mono text-[10px] text-white/30 tracking-widest mb-2">FEATURES</p>
          <ToggleRow label="Streaming" value={streamingEnabled} onChange={setStreamingEnabled} />
          <ToggleRow label="Memory" value={memoryEnabled} onChange={setMemoryEnabled} />
        </div>

        <div className="mt-auto" />

        {/* Sidebar: Status */}
        <div className="px-6 py-6 border-t border-[#333]">
          <div className="flex items-center gap-3 mb-3">
            <motion.div
              animate={loading
                ? { scale: [0.8, 1.3, 0.8], opacity: [0.3, 1, 0.3] }
                : { scale: 1, opacity: 0.25 }}
              transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : {}}
              className={`w-2 h-2 rounded-full ${loading ? 'bg-[#00E676]' : 'bg-white'}`}
            />
            <span className={`font-mono text-[11px] font-semibold tracking-wider ${loading ? 'text-[#00E676]' : 'text-white/40'}`}>
              {loading ? 'INFERENCE ACTIVE' : 'IDLE'}
            </span>
          </div>
          {totalInferences > 0 && (
            <p className="font-mono text-[10px] text-white/25">Sessions: {totalInferences}</p>
          )}
        </div>
      </div>

      {/* ═══ MAIN WORKSPACE ═══ */}
      <div className="flex-1 flex flex-col relative">

        {/* Header */}
        <header className="h-16 px-8 flex items-center justify-between shrink-0 border-b border-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <span className="text-[#00E676]">{modeConfig.icon}</span>
            <h2 className="text-lg font-semibold">{mode}</h2>
            <span className="text-[12px] text-white/30 font-mono">· {modeConfig.tokens} tokens · t={modeConfig.temperature}</span>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {!loading && lastLatencyMs > 0 && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="px-3 py-1.5 bg-[#1A1A1A] border border-[#333] rounded-md font-mono text-[11px] text-white/60">
                  ⚡{lastLatencyMs}ms &nbsp;·&nbsp; ✍{lastCharCount} chars
                </motion.div>
              )}
            </AnimatePresence>
            {messages.length > 0 && (
              <button onClick={exportChat} className="p-2 text-white/40 hover:text-[#00E676] hover:bg-white/5 rounded-md transition-colors" title="Export chat (Markdown)">
                <Download size={18} />
              </button>
            )}
            <button onClick={newChat} className="p-2 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors" title="Clear chat">
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-8 pb-40">
          <div className="max-w-[900px] mx-auto flex flex-col gap-6 pt-6">

            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="flex flex-col items-center justify-center pt-32 text-center">
                <Cpu size={48} className="text-[#00E676]/20 mb-6" />
                <h3 className="text-xl font-semibold text-white/80 mb-2">LocalHost-AI Workspace</h3>
                <p className="text-white/30 text-sm max-w-md">Your fully offline, privacy-first AI assistant. Connect your local LLM via llama.cpp at <code className="text-[#00E676]/60 font-mono text-xs">127.0.0.1:8080</code></p>
                <div className="flex gap-2 mt-6">
                  {(['Quick', 'Reasoning', 'Writing'] as InferenceMode[]).map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all
                        ${mode === m ? 'bg-[#00E676] text-[#003918] font-bold' : 'border border-[#333] text-white/40 hover:text-white hover:border-white/30'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Messages */}
            <AnimatePresence>
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div key={idx}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`relative max-w-[80%] rounded-2xl ${isUser
                        ? 'border border-[#333] px-5 py-4'
                        : 'bg-[#262626] px-5 py-4'}`}>

                      {/* Copy button (assistant only) */}
                      {!isUser && msg.content && (
                        <button onClick={() => copyText(msg.content, idx)}
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-white/10 text-white/40">
                          {copiedIdx === idx ? <Check size={14} className="text-[#00E676]" /> : <Copy size={14} />}
                        </button>
                      )}

                      {isUser ? (
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <TypewriterContent
                          text={msg.content || '...'}
                          animate={!animatedMsgs.has(msg.timestamp)}
                          onComplete={() => setAnimatedMsgs(prev => new Set(prev).add(msg.timestamp))}
                        />
                      )}

                      {/* Latency badge */}
                      {!isUser && msg.latencyMs && (
                        <p className="mt-3 font-mono text-[10px] text-white/20">{msg.latencyMs}ms</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Loading indicator */}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-[#262626] rounded-2xl px-5 py-4 flex items-center gap-2">
                  <motion.div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                        className="w-2 h-2 rounded-full bg-[#00E676]" />
                    ))}
                  </motion.div>
                  <span className="font-mono text-[11px] text-white/30 ml-2">Generating...</span>
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} className="h-4" />
          </div>
        </div>

        {/* ═══ INPUT DOCK ═══ */}
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="absolute bottom-6 left-8 right-8 flex justify-center pointer-events-none">
          <div className="w-full max-w-[900px] bg-[#1A1A1A] border border-[#333] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] pointer-events-auto">
            <div className="flex items-end p-2">
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown} placeholder="Enter prompt..." rows={1}
                className="flex-1 bg-transparent text-white placeholder-white/25 p-4 resize-none outline-none max-h-48 min-h-[56px] text-[15px]" />
              <button onClick={sendPrompt} disabled={loading || !input.trim()}
                className={`p-3 m-1 rounded-xl transition-all duration-200
                  ${loading || !input.trim() ? 'bg-[#333] text-white/20 cursor-not-allowed' : 'bg-[#00E676] text-[#003918] hover:bg-[#00c968] hover:scale-105'}`}>
                <ArrowUp size={22} />
              </button>
            </div>
            <div className="flex items-center justify-between px-5 pb-3 text-white/20">
              <span className="font-mono text-[10px]">{mode} · {modeConfig.tokens} tokens · {streamingEnabled ? 'Stream' : 'Instant'}</span>
              <span className="font-mono text-[10px]">{input.length} chars</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══ SETTINGS OVERLAY ═══ */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setShowSettings(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1A1A] border border-[#333] rounded-2xl w-[480px] max-h-[80vh] overflow-y-auto p-8"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Workspace Parameters</h2>
                <button onClick={() => setShowSettings(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/50"><X size={20} /></button>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="font-mono text-[10px] text-white/30 tracking-widest mb-3">INFERENCE MODE</p>
                  {(['Quick', 'Reasoning', 'Writing'] as InferenceMode[]).map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all
                        ${mode === m ? 'bg-[#00E676]/10 text-[#00E676] ring-1 ring-[#00E676]/30' : 'text-white/50 hover:bg-white/5'}`}>
                      {MODE_CONFIG[m].icon}
                      <div className="text-left">
                        <p className="text-sm font-medium">{m}</p>
                        <p className="text-[11px] opacity-50">{MODE_CONFIG[m].description} · {MODE_CONFIG[m].tokens} tokens · temp {MODE_CONFIG[m].temperature}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div>
                  <p className="font-mono text-[10px] text-white/30 tracking-widest mb-3">FEATURES</p>
                  <ToggleRow label="Streaming Responses" value={streamingEnabled} onChange={setStreamingEnabled} />
                  <ToggleRow label="Context Memory" value={memoryEnabled} onChange={setMemoryEnabled} />
                </div>

                <div>
                  <p className="font-mono text-[10px] text-white/30 tracking-widest mb-3">DANGER ZONE</p>
                  <button onClick={() => { clearMemory(); setShowSettings(false); }}
                    className="w-full px-4 py-3 rounded-lg text-sm text-red-400 border border-red-400/20 hover:bg-red-400/10 transition-all">
                    Clear Global Memory
                  </button>
                </div>
              </div>

              <button onClick={() => setShowSettings(false)}
                className="w-full mt-8 py-3 rounded-xl bg-[#00E676] text-[#003918] font-semibold hover:bg-[#00c968] transition-colors">
                Done
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
    <button onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
      <span className="text-[13px] text-white/70">{label}</span>
      {value
        ? <ToggleRight size={22} className="text-[#00E676]" />
        : <ToggleLeft size={22} className="text-white/30" />
      }
    </button>
  );
}

export default App;
