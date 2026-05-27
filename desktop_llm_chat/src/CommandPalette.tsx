import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Terminal, PlusSquare, SlidersHorizontal, Trash2,
  Cpu, Download, Sparkles, BookOpen, BrainCircuit
} from 'lucide-react';

interface CommandItem {
  icon: React.ReactNode;
  label: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setMode: (mode: 'Quick' | 'Reasoning' | 'Writing') => void;
  setStreamingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setMemoryEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  streamingEnabled: boolean;
  memoryEnabled: boolean;
  newChat: () => void;
  clearMemory: () => void;
  setShowSettings: (show: boolean) => void;
  exportChat: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  setMode,
  setStreamingEnabled,
  setMemoryEnabled,
  streamingEnabled,
  memoryEnabled,
  newChat,
  clearMemory,
  setShowSettings,
  exportChat
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  const commands: CommandItem[] = [
    {
      icon: <Terminal className="text-[#00E676]" size={18} />,
      label: 'Set Mode to Quick (Low Latency)',
      category: 'Inference Modes',
      shortcut: 'M 1',
      action: () => { setMode('Quick'); onClose(); }
    },
    {
      icon: <BrainCircuit className="text-purple-400" size={18} />,
      label: 'Set Mode to Reasoning (High Precision)',
      category: 'Inference Modes',
      shortcut: 'M 2',
      action: () => { setMode('Reasoning'); onClose(); }
    },
    {
      icon: <Sparkles className="text-blue-400" size={18} />,
      label: 'Set Mode to Writing (Creative)',
      category: 'Inference Modes',
      shortcut: 'M 3',
      action: () => { setMode('Writing'); onClose(); }
    },
    {
      icon: <PlusSquare className="text-white/60" size={18} />,
      label: 'Start New Session (Clear History)',
      category: 'Chat Actions',
      shortcut: 'Ctrl+N',
      action: () => { newChat(); onClose(); }
    },
    {
      icon: <Download className="text-white/60" size={18} />,
      label: 'Export Chat Log to Markdown',
      category: 'Chat Actions',
      shortcut: 'Ctrl+S',
      action: () => { exportChat(); onClose(); }
    },
    {
      icon: <Trash2 className="text-red-400" size={18} />,
      label: 'Clear Global Memory Vault',
      category: 'Danger Zone',
      action: () => { clearMemory(); onClose(); }
    },
    {
      icon: <SlidersHorizontal className="text-[#00E676]" size={18} />,
      label: 'Open Parameters Overlay',
      category: 'Settings',
      shortcut: 'Ctrl+,',
      action: () => { setShowSettings(true); onClose(); }
    },
    {
      icon: <BookOpen className={streamingEnabled ? 'text-[#00E676]' : 'text-white/40'} size={18} />,
      label: `${streamingEnabled ? 'Disable' : 'Enable'} Live Token Streaming`,
      category: 'Toggle Features',
      shortcut: 'T S',
      action: () => { setStreamingEnabled(prev => !prev); onClose(); }
    },
    {
      icon: <Cpu className={memoryEnabled ? 'text-[#00E676]' : 'text-white/40'} size={18} />,
      label: `${memoryEnabled ? 'Disable' : 'Enable'} Local Context Memory`,
      category: 'Toggle Features',
      shortcut: 'T M',
      action: () => { setMemoryEnabled(prev => !prev); onClose(); }
    }
  ];

  const filtered = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          filtered[activeIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, filtered]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 bg-[#000000a6] backdrop-blur-[6px] z-50 flex items-start justify-center pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            ref={containerRef}
            initial={{ scale: 0.96, y: -10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: -10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="bg-[#151716] border border-[#2b3530] rounded-2xl w-[600px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2b3530]">
              <Search className="text-[#3bf185] shrink-0" size={20} />
              <input
                ref={inputRef}
                value={search}
                onChange={e => { setSearch(e.target.value); setActiveIndex(0); }}
                placeholder="Search commands or parameters..."
                className="w-full bg-transparent text-white placeholder-white/20 outline-none text-[15px]"
              />
              <span className="text-[10px] font-mono bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/40 shadow-inner">ESC</span>
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto p-2 scrollbar-thin scrollbar-track-transparent">
              {filtered.length > 0 ? (
                Object.entries(
                  filtered.reduce((acc, cmd) => {
                    if (!acc[cmd.category]) acc[cmd.category] = [];
                    acc[cmd.category].push(cmd);
                    return acc;
                  }, {} as Record<string, CommandItem[]>)
                ).map(([category, items]) => (
                  <div key={category} className="mb-2">
                    <div className="text-[10px] font-semibold text-[#3bf185]/40 uppercase tracking-widest font-mono px-3 py-1.5">
                      {category}
                    </div>
                    {items.map((cmd) => {
                      const absoluteIndex = filtered.indexOf(cmd);
                      const isSelected = absoluteIndex === activeIndex;

                      return (
                        <button
                          key={cmd.label}
                          onClick={cmd.action}
                          onMouseEnter={() => setActiveIndex(absoluteIndex)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 relative ${
                            isSelected
                              ? 'bg-[#3bf185]/10 border border-[#3bf185]/20 shadow-[0_0_15px_rgba(59,241,133,0.05)]'
                              : 'border border-transparent hover:bg-white/2'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`transition-all duration-200 ${isSelected ? 'scale-110' : 'opacity-60'}`}>
                              {cmd.icon}
                            </span>
                            <span className={`text-[13.5px] transition-colors duration-150 font-medium ${isSelected ? 'text-white font-semibold' : 'text-white/70'}`}>
                              {cmd.label}
                            </span>
                          </div>
                          {cmd.shortcut && (
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors duration-150 ${
                              isSelected
                                ? 'bg-[#3bf185]/20 border-[#3bf185]/40 text-[#3bf185] font-semibold'
                                : 'bg-white/5 border-white/10 text-white/30'
                            }`}>
                              {cmd.shortcut}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="text-white/20 text-[14px]">No command results found</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-[#2b3530] bg-[#0c0e0d] flex items-center justify-between text-white/30 text-[10px] font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><kbd className="bg-white/5 border border-white/10 px-1 py-0.5 rounded shadow">↑↓</kbd> Navigate</span>
                <span className="flex items-center gap-1"><kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shadow">Enter</kbd> Select</span>
              </div>
              <div>
                LocalHost-AI Command Hub
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
