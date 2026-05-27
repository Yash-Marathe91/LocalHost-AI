import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface TypewriterContentProps {
  text: string;
  animate: boolean;
  onComplete: () => void;
}

export default function TypewriterContent({ text, animate, onComplete }: TypewriterContentProps) {
  const [displayLen, setDisplayLen] = useState(animate ? 0 : text.length);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(!animate);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!animate || !text) {
      setDisplayLen(text.length);
      return;
    }

    const startTime = Date.now();
    // Adaptive: finish typing in 1.5–5 seconds regardless of length
    const duration = Math.max(1.5, Math.min(5, text.length / 200));
    const cps = text.length / duration;

    completedRef.current = false;
    setDisplayLen(0);

    const step = () => {
      const elapsed = Date.now() - startTime;
      const target = Math.floor((elapsed / 1000) * cps);

      if (target >= text.length) {
        setDisplayLen(text.length);
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
        return;
      }

      setDisplayLen(target);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [animate, text]);

  const skip = useCallback(() => {
    if (!completedRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setDisplayLen(text.length);
      completedRef.current = true;
      onCompleteRef.current();
    }
  }, [text.length]);

  const displayed = text.substring(0, displayLen);
  const isTyping = animate && displayLen < text.length;

  return (
    <div
      onClick={isTyping ? skip : undefined}
      className={isTyping ? 'cursor-pointer' : ''}
      title={isTyping ? 'Click to skip animation' : ''}
    >
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const codeStr = String(children).replace(/\n$/, '');
              return match ? (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    background: '#131313',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    fontSize: '13px',
                  }}
                >
                  {codeStr}
                </SyntaxHighlighter>
              ) : (
                <code
                  className="bg-[#131313] text-[#75ff9e] px-1.5 py-0.5 rounded font-mono text-[13px]"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            a({ children, ...props }) {
              return (
                <a className="text-[#00E676] hover:underline" {...props}>
                  {children}
                </a>
              );
            },
          }}
        >
          {displayed || '...'}
        </ReactMarkdown>
      </div>
      {isTyping && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.53 }}
          className="inline-block w-1.5 h-[18px] bg-[#00E676] rounded-sm mt-1"
        />
      )}
    </div>
  );
}
