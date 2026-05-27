import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, PlusSquare, SlidersHorizontal, ArrowUp, Trash2,
  Copy, Check, X, Cpu, ToggleLeft, ToggleRight, Download,
  Brain, ChevronLeft, ChevronRight, Command, FolderOpen,
  AlertTriangle, RefreshCw, Settings, Edit3
} from 'lucide-react';

import { MemoryService } from './memory';
import TypewriterContent from './TypewriterContent';
import LandingPage from './LandingPage';
import CommandPalette from './CommandPalette';
import MemoryPanel from './MemoryPanel';
import { MODE_CONFIG, buildPrompt } from './config';
import type { InferenceMode, Message } from './config';

// ── ELECTRON IPC CONFIGURATION ──
const isElectron = typeof window !== 'undefined' && (window as any).require !== undefined;
const electron = isElectron ? (window as any).require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  mode: InferenceMode;
  timestamp: number;
}

function App() {
  const [onboarded, setOnboarded] = useState(false);
  
  // ── PERSISTENT MULTI-SESSION CHAT STATE ──
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const raw = localStorage.getItem('localhost_ai_sessions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('[Sessions] Failed to parse sessions:', e);
    }
    const initialSession: ChatSession = {
      id: 'default',
      title: 'Initial Conversation',
      messages: [],
      mode: 'Quick',
      timestamp: Date.now()
    };
    return [initialSession];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('localhost_ai_active_session_id');
      if (raw) return raw;
    } catch {}
    return 'default';
  });

  // Derived messages state
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const [messages, setMessages] = useState<Message[]>(activeSession.messages || []);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<InferenceMode>(activeSession.mode || 'Quick');
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

  // ── DYNAMIC LOCAL LLM CONFIG & STATUS STATE ──
  const [llamaStatus, setLlamaStatus] = useState<{ status: string; error: string }>({
    status: isElectron ? 'checking' : 'stopped',
    error: ''
  });

  const [llamaConfigState, setLlamaConfigState] = useState<{
    llamaDir: string;
    llamaExe: string;
    modelPath: string;
    gpuLayers: number;
    port: number;
  }>({
    llamaDir: 'C:\\testLlama\\llama.cpp',
    llamaExe: 'C:\\testLlama\\llama.cpp\\build\\bin\\Release\\llama-server.exe',
    modelPath: 'C:\\testLlama\\llama.cpp\\models\\Meta-Llama-3-8B-Instruct-Q4_K_M.gguf',
    gpuLayers: 0,
    port: 8080
  });

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
        const isModelActive = llamaStatus.status === 'running';
        const speedOffset = (Math.random() - 0.5) * 0.8;
        const vramOffset = (Math.random() - 0.5) * 0.1;
        const cpuOffset = (Math.random() - 0.5) * 4;

        return {
          tSpeed: isModelActive ? Math.max(8.0, Math.min(18.0, Number((prev.tSpeed + speedOffset).toFixed(1)))) : 0,
          vram: isModelActive ? Math.max(4.0, Math.min(7.9, Number((prev.vram + vramOffset).toFixed(1)))) : 0,
          cpu: isModelActive ? Math.max(10, Math.min(85, Math.round(prev.cpu + cpuOffset))) : Math.max(1, Math.round(Math.random() * 5))
        };
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [llamaStatus]);

  // ── SESSIONS PERSISTENCE SYNC ──
  useEffect(() => {
    localStorage.setItem('localhost_ai_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('localhost_ai_active_session_id', activeSessionId);
  }, [activeSessionId]);

  // Sync messages and mode changes back to active session
  useEffect(() => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages, mode };
      }
      return s;
    }));
  }, [messages, activeSessionId, mode]);

  // ── DYNAMIC LOCAL LLM IPC SYNC ──
  useEffect(() => {
    if (ipcRenderer) {
      // 1. Fetch current startup status
      const status = ipcRenderer.sendSync('get-llama-status');
      if (status) setLlamaStatus(status);

      // 2. Fetch current configurations
      const config = ipcRenderer.sendSync('get-llama-config');
      if (config) setLlamaConfigState(config);

      // 3. Listen for dynamic status changes
      const handleStatusChange = (_event: any, arg: any) => {
        setLlamaStatus(arg);
      };
      ipcRenderer.on('llama-status-change', handleStatusChange);

      return () => {
        ipcRenderer.removeListener('llama-status-change', handleStatusChange);
      };
    }
  }, []);

  // Save server config in Electron
  const saveLlamaConfig = (newConfig: typeof llamaConfigState) => {
    if (ipcRenderer) {
      const res = ipcRenderer.sendSync('save-llama-config', newConfig);
      if (res && res.success) {
        setLlamaConfigState(newConfig);
        return { success: true };
      } else {
        return { success: false, error: res?.error || 'Save configuration failed' };
      }
    }
    return { success: false, error: 'Not in Electron environment' };
  };

  const restartLlamaServer = () => {
    if (ipcRenderer) {
      setLlamaStatus({ status: 'starting', error: '' });
      ipcRenderer.sendSync('restart-llama');
    }
  };

  const handleBrowseFile = (field: 'llamaExe' | 'modelPath', filters: any[]) => {
    if (ipcRenderer) {
      const path = ipcRenderer.sendSync('select-file', filters);
      if (path) {
        setLlamaConfigState(prev => ({ ...prev, [field]: path }));
      }
    }
  };

  const handleBrowseDir = () => {
    if (ipcRenderer) {
      const path = ipcRenderer.sendSync('select-directory');
      if (path) {
        setLlamaConfigState(prev => ({ ...prev, llamaDir: path }));
      }
    }
  };

  // ── SESSIONS MANAGEMENT ACTIONS ──
  const selectSession = (sessionId: string) => {
    const sess = sessions.find(s => s.id === sessionId);
    if (sess) {
      setActiveSessionId(sessionId);
      setMessages(sess.messages || []);
      setMode(sess.mode || 'Quick');
      setLastLatencyMs(0);
      setLastCharCount(0);
      setAnimatedMsgs(new Set());
    }
  };

  const newChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      messages: [],
      mode: mode,
      timestamp: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessages([]);
    setLastLatencyMs(0);
    setLastCharCount(0);
    setAnimatedMsgs(new Set());
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      // Just clear active messages
      setMessages([]);
      setSessions([{
        id: 'default',
        title: 'Initial Conversation',
        messages: [],
        mode: mode,
        timestamp: Date.now()
      }]);
      setActiveSessionId('default');
      return;
    }
    const filteredSess = sessions.filter(s => s.id !== sessionId);
    setSessions(filteredSess);
    if (activeSessionId === sessionId) {
      selectSession(filteredSess[0].id);
    }
  };

  const renameSessionPrompt = (sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTitle = prompt('Rename this session:', currentTitle);
    if (newTitle && newTitle.trim()) {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle.trim() } : s));
    }
  };


  // ── SEND ──
  const sendPrompt = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setInput('');
    setLoading(true);

    // Auto-rename the session based on the first prompt
    if (messages.length === 0) {
      const truncatedTitle = text.length > 28 ? text.substring(0, 25) + '...' : text;
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, title: truncatedTitle };
        }
        return s;
      }));
    }

    if (memoryEnabled) MemoryService.addMessage('user', text);

    const memoryText = memoryEnabled
      ? MemoryService.getRecent(6).map(m => `- ${m.role}: ${m.content}`).join('\n')
      : 'Memory disabled or empty.';
    const promptText = buildPrompt(text, mode, memoryEnabled, memoryText);
    const config = MODE_CONFIG[mode];
    const start = Date.now();

    abortControllerRef.current = new AbortController();

    if (streamingEnabled) {
      await streamResponse(promptText, config, start, updatedMsgs);
    } else {
      await instantResponse(promptText, config, start, updatedMsgs);
    }
  }, [input, loading, mode, streamingEnabled, memoryEnabled, messages, activeSessionId]);

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
    promptStr: string,
    config: typeof MODE_CONFIG['Quick'],
    start: number,
    currentMsgsList: Message[]
  ) => {
    try {
      const endpoint = `http://127.0.0.1:${llamaConfigState.port}/completion`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          prompt: promptStr,
          n_predict: config.tokens,
          temperature: config.temperature,
          stop: ['<|eot_id|>', '<|start_header_id|>', 'User:', 'Assistant:'],
          stream: false,
        }),
      });
      const data = await res.json();
      const reply = (data.content ?? '').trim();
      const latency = Date.now() - start;

      const assistantMsg: Message = { role: 'assistant', content: reply, timestamp: Date.now(), latencyMs: latency };
      setMessages([...currentMsgsList, assistantMsg]);
      setLastLatencyMs(latency);
      setLastCharCount(reply.length);
      if (memoryEnabled) MemoryService.addMessage('assistant', reply);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const errContent = '⚠ Could not reach local LLM at port ' + llamaConfigState.port + '. Ensure llama-server is configured and running.';
        setMessages([...currentMsgsList, { role: 'assistant', content: errContent, timestamp: Date.now() }]);
      }
    }
    setLoading(false);
  };

  // ── STREAMING RESPONSE ──
  const streamResponse = async (
    promptStr: string,
    config: typeof MODE_CONFIG['Quick'],
    start: number,
    currentMsgsList: Message[]
  ) => {
    try {
      const endpoint = `http://127.0.0.1:${llamaConfigState.port}/completion`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          prompt: promptStr,
          n_predict: config.tokens,
          temperature: config.temperature,
          stop: ['<|eot_id|>', '<|start_header_id|>', 'User:', 'Assistant:'],
          stream: true,
        }),
      });

      const assistantMsg: Message = { role: 'assistant', content: '', timestamp: Date.now() };
      const withAssistantList = [...currentMsgsList, assistantMsg];
      setMessages(withAssistantList);
      setAnimatedMsgs(prev => new Set(prev).add(assistantMsg.timestamp));
      const msgIdx = withAssistantList.length - 1;

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
        const errContent = '⚠ Stream connection failed. Ensure llama-server is configured and running on port ' + llamaConfigState.port + '.';
        setMessages([...currentMsgsList, { role: 'assistant', content: errContent, timestamp: Date.now() }]);
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

      {/* ═══ COLLAPSIBLE SIDEBAR ═══ */}
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
            { icon: <PlusSquare size={17} />, label: 'New Session', idx: 1, action: newChat },
            { icon: <Brain size={17} />, label: 'Memory Vault', idx: 3, action: () => setMemoryPanelOpen(true) },
            { icon: <SlidersHorizontal size={17} />, label: 'Config Panel', idx: 2, action: () => setShowSettings(true) },
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

        {/* ── PERSISTENT CHAT HISTORY SECTION ── */}
        {!sidebarCollapsed && (
          <div className="px-5 mt-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[9px] text-white/30 tracking-widest uppercase">Chat Sessions</span>
              <button
                onClick={newChat}
                className="text-white/40 hover:text-[#3bf185] transition-all p-1 hover:bg-white/5 rounded"
                title="Create Conversation"
              >
                <PlusSquare size={13} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin pr-1 max-h-[220px]">
              {sessions.map(s => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    className={`group flex items-center justify-between rounded-xl px-3 py-2 transition-all text-xs border ${
                      isActive
                        ? 'bg-[#3bf185]/10 border-[#3bf185]/25 text-[#3bf185] shadow-[0_0_15px_rgba(59,241,133,0.03)]'
                        : 'border-transparent text-white/40 hover:bg-white/3 hover:text-white'
                    }`}
                  >
                    <button
                      onClick={() => selectSession(s.id)}
                      className="flex-1 text-left truncate font-sans font-medium"
                    >
                      {s.title}
                    </button>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                      {/* Rename icon */}
                      <button
                        onClick={(e) => renameSessionPrompt(s.id, s.title, e)}
                        className="p-0.5 hover:bg-white/5 rounded text-white/40 hover:text-white"
                        title="Rename Session"
                      >
                        <Edit3 size={11} />
                      </button>
                      
                      {/* Delete icon */}
                      <button
                        onClick={(e) => deleteSession(s.id, e)}
                        className="p-0.5 hover:bg-red-500/20 rounded text-white/40 hover:text-red-400"
                        title="Delete Session"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
              <span className="font-mono text-[8px] text-[#3bf185]/50 tracking-widest uppercase">Hardware Core</span>
              <span className={`w-1.5 h-1.5 rounded-full ${llamaStatus.status === 'running' ? 'bg-[#3bf185] animate-ping' : 'bg-red-500'}`} />
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
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                llamaStatus.status === 'running'
                  ? 'bg-[#3bf185]'
                  : llamaStatus.status === 'starting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <span className={`block font-mono text-[10px] font-bold tracking-wider ${
                  llamaStatus.status === 'running' ? 'text-[#3bf185]' : 'text-red-400'
                }`}>
                  {llamaStatus.status === 'running'
                    ? 'ONLINE LOCAL'
                    : llamaStatus.status === 'starting'
                    ? 'STARTING...'
                    : 'OFFLINE NODE'}
                </span>
                <span className="block text-[8px] font-mono text-white/20 mt-0.5">Port {llamaConfigState.port} Active</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ═══ MAIN WORKSPACE ═══ */}
      <div className="flex-1 flex flex-col relative bg-[#0b0d0c]">
        
        {/* Connection Trouble Header Banner */}
        {llamaStatus.status !== 'running' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-red-500/10 border-b border-red-500/20 px-8 py-3 flex items-center justify-between text-xs text-red-200/90 z-20 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-400 shrink-0" size={16} />
              <div>
                <span className="font-bold">LLM Engine is offline:</span>{' '}
                <span className="opacity-75">
                  {llamaStatus.status === 'not_found'
                    ? 'Required file paths not found. Setup your local executable and weights.'
                    : llamaStatus.error || 'Server process exited or failed to start.'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1 bg-red-400/20 hover:bg-red-400/30 text-red-200 border border-red-500/30 rounded-lg px-3 py-1 font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <Settings size={12} /> Configure LLM Node
            </button>
          </motion.div>
        )}

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
              onClick={() => setMessages([])}
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
                className="flex flex-col items-center justify-center pt-20 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#3bf185]/5 border border-[#3bf185]/10 flex items-center justify-center mb-6 shadow-inner animate-pulse">
                  <Cpu size={32} className="text-[#3bf185]/40" />
                </div>
                <h3 className="text-[17px] font-bold text-white/80 mb-2 font-sans tracking-tight">Offline AI Workspace</h3>
                <p className="text-white/40 text-xs max-w-sm leading-relaxed mb-6">
                  Running entirely on your physical hardware. Direct interface with local llama-server node on port <code className="text-[#3bf185] font-mono text-[11px] bg-[#3bf185]/10 px-1 rounded">{llamaConfigState.port}</code>.
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
                placeholder={
                  llamaStatus.status === 'running'
                    ? "Enter prompt to query Llama-3 local model..."
                    : "LLM Node Offline. Setup paths in Parameters overlay."
                }
                rows={1}
                disabled={llamaStatus.status !== 'running'}
                className="flex-1 bg-transparent text-white placeholder-white/20 p-4 resize-none outline-none max-h-48 min-h-[56px] text-[14.5px] font-sans disabled:cursor-not-allowed"
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
                  disabled={!input.trim() || llamaStatus.status !== 'running'}
                  className={`p-3.5 m-1 rounded-xl transition-all duration-300 cursor-pointer shadow-lg ${
                    !input.trim() || llamaStatus.status !== 'running'
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

      {/* ═══ WORKSPACE CONFIG / SETTINGS OVERLAY ═══ */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#000000bd] backdrop-blur-[6px] z-50 flex items-center justify-center overflow-y-auto py-10"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="bg-[#121413] border border-[#2b3530] rounded-2xl w-[580px] max-h-[90vh] overflow-y-auto p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
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

                {/* ── ELECTRON LOCAL LLM HOST CONTROLS ── */}
                {isElectron && (
                  <div className="p-5 rounded-2xl bg-white/2 border border-[#2b3530] space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] text-[#3bf185] tracking-widest uppercase">Local LLM Service</span>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          llamaStatus.status === 'running'
                            ? 'bg-[#3bf185] shadow-[0_0_8px_#3bf185]'
                            : llamaStatus.status === 'starting'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-red-500'
                        }`} />
                        <span className="font-mono text-[10px] uppercase font-bold text-white/60">
                          {llamaStatus.status}
                        </span>
                      </div>
                    </div>

                    {llamaStatus.error && (
                      <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-300 text-[11px] rounded-lg font-mono whitespace-pre-wrap break-all leading-normal">
                        {llamaStatus.error}
                      </div>
                    )}

                    {/* Exe Path selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-white/40">llama-server.exe Executable Path</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={llamaConfigState.llamaExe}
                          onChange={e => setLlamaConfigState(prev => ({ ...prev, llamaExe: e.target.value }))}
                          className="flex-1 bg-white/2 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#3bf185]/30 text-white/80"
                        />
                        <button
                          onClick={() => handleBrowseFile('llamaExe', [{ name: 'Executables', extensions: ['exe'] }])}
                          className="px-3.5 bg-white/5 border border-white/10 hover:border-[#3bf185]/30 rounded-xl text-white/60 hover:text-white transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <FolderOpen size={13} /> <span>Browse</span>
                        </button>
                      </div>
                    </div>

                    {/* Model Path selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-white/40">GGUF Model Weights file Path</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={llamaConfigState.modelPath}
                          onChange={e => setLlamaConfigState(prev => ({ ...prev, modelPath: e.target.value }))}
                          className="flex-1 bg-white/2 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#3bf185]/30 text-white/80"
                        />
                        <button
                          onClick={() => handleBrowseFile('modelPath', [{ name: 'Model Files', extensions: ['gguf'] }])}
                          className="px-3.5 bg-white/5 border border-white/10 hover:border-[#3bf185]/30 rounded-xl text-white/60 hover:text-white transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <FolderOpen size={13} /> <span>Browse</span>
                        </button>
                      </div>
                    </div>

                    {/* Directory Llama */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-white/40">Llama.cpp Directory Root</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={llamaConfigState.llamaDir}
                          onChange={e => setLlamaConfigState(prev => ({ ...prev, llamaDir: e.target.value }))}
                          className="flex-1 bg-white/2 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#3bf185]/30 text-white/80"
                        />
                        <button
                          onClick={handleBrowseDir}
                          className="px-3.5 bg-white/5 border border-white/10 hover:border-[#3bf185]/30 rounded-xl text-white/60 hover:text-white transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <FolderOpen size={13} /> <span>Browse</span>
                        </button>
                      </div>
                    </div>

                    {/* GPU and Port inputs */}
                    <div className="grid grid-cols-2 gap-3.5 pt-2">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-mono text-white/40">GPU Offload Layers (e.g. 33)</label>
                        <input
                          type="number"
                          value={llamaConfigState.gpuLayers}
                          onChange={e => setLlamaConfigState(prev => ({ ...prev, gpuLayers: Number(e.target.value) }))}
                          className="w-full bg-white/2 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#3bf185]/30 text-white/80"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-mono text-white/40">Local Port Binding</label>
                        <input
                          type="number"
                          value={llamaConfigState.port}
                          onChange={e => setLlamaConfigState(prev => ({ ...prev, port: Number(e.target.value) }))}
                          className="w-full bg-white/2 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#3bf185]/30 text-white/80"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={restartLlamaServer}
                        className="flex-1 py-2.5 rounded-xl border border-[#3bf185]/20 text-[#3bf185] hover:bg-[#3bf185]/10 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <RefreshCw size={13} /> Reload & Boot LLM
                      </button>
                    </div>
                  </div>
                )}

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
                    className="w-full py-3.5 rounded-xl text-xs font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/10 active:scale-98 transition-all duration-200 cursor-pointer"
                  >
                    Purge Context Memory Vault
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  saveLlamaConfig(llamaConfigState);
                  setShowSettings(false);
                }}
                className="w-full mt-8 py-3.5 rounded-xl bg-[#3bf185] text-[#0a2f1a] font-bold text-xs hover:bg-[#2fe578] active:scale-95 transition-all duration-200 shadow-md cursor-pointer"
              >
                Save configurations
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
