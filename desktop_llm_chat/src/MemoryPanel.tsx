import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Trash2, X, AlertCircle } from 'lucide-react';
import { MemoryService } from './memory';

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MemoryPanel({ isOpen, onClose }: MemoryPanelProps) {
  const [memories, setMemories] = useState<{ role: string; content: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      setMemories(MemoryService.load());
    }
  }, [isOpen]);

  const handleDeleteItem = (index: number) => {
    const loaded = MemoryService.load();
    loaded.splice(index, 1);
    MemoryService.save(loaded);
    setMemories(loaded);
  };

  const handleClearAll = () => {
    MemoryService.clear();
    setMemories([]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#000000a6] backdrop-blur-[4px] z-40"
          />

          {/* Slide-out Sidebar Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-[380px] bg-[#121413] border-l border-[#2b3530] z-50 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="p-6 border-b border-[#2b3530] flex items-center justify-between bg-[#151816]">
              <div className="flex items-center gap-2.5">
                <Brain className="text-[#3bf185] animate-pulse" size={20} />
                <div>
                  <h3 className="font-semibold text-[15px] tracking-tight">Memory Vault</h3>
                  <p className="text-[10px] text-white/30 font-mono uppercase tracking-wider">Local Context Pool</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 scrollbar-thin scrollbar-track-transparent">
              <AnimatePresence initial={false}>
                {memories.length > 0 ? (
                  memories.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, x: 20 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                      className={`p-4 rounded-xl border relative group transition-all duration-300 ${
                        item.role === 'user'
                          ? 'bg-[#181c19]/50 border-[#222e26]/60 shadow-[0_2px_12px_rgba(0,0,0,0.15)]'
                          : 'bg-[#1e2320]/30 border-[#2b382f]/40 shadow-inner'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-mono uppercase font-bold tracking-wider rounded px-1.5 py-0.5 ${
                          item.role === 'user'
                            ? 'bg-[#3bf185]/15 text-[#3bf185]'
                            : 'bg-white/10 text-white/60'
                        }`}>
                          {item.role === 'user' ? 'USER' : 'ASSISTANT'}
                        </span>
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded"
                          title="Forget memory"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p className="text-[13px] text-white/80 leading-relaxed font-sans whitespace-pre-wrap break-words">
                        {item.content}
                      </p>
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center pt-24 text-center px-4"
                  >
                    <AlertCircle className="text-white/15 mb-3" size={32} />
                    <p className="text-[13px] text-white/40 font-sans leading-relaxed">
                      Your memory vault is currently empty. Start chatting with LocalHost-AI to accumulate active memory cards!
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Control */}
            {memories.length > 0 && (
              <div className="p-4 border-t border-[#2b3530] bg-[#151816]">
                <button
                  onClick={handleClearAll}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/20 text-red-400/90 text-[12px] font-semibold hover:bg-red-400/10 active:scale-95 transition-all duration-200"
                >
                  <Trash2 size={14} /> Clear Vault Pool
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
