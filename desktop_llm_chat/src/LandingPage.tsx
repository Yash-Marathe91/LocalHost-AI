import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, SlidersHorizontal, Database, Cpu, ArrowRight } from 'lucide-react';
import StarBorder from './StarBorder';

declare global {
  interface Window {
    VANTA?: any;
  }
}

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  const vantaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let effect: any = null;
    if (vantaRef.current && window.VANTA && window.VANTA.NET) {
      try {
        effect = window.VANTA.NET({
          el: vantaRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.00,
          minWidth: 200.00,
          scale: 1.00,
          scaleMobile: 1.00,
          color: 0x3bf185,
          backgroundColor: 0x0b0d0c,
          points: 11.00,
          maxDistance: 19.00,
          spacing: 14.00
        });
      } catch (err) {
        console.error('Vanta initialization error:', err);
      }
    }
    return () => {
      if (effect) {
        try {
          effect.destroy();
        } catch (err) {
          console.error('Vanta destroy error:', err);
        }
      }
    };
  }, []);

  return (
    <div style={{ background: '#0b0d0c', minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif", overflow: 'auto', position: 'relative' }}>
      <div ref={vantaRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }} />
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

        {/* Header */}
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px', background: 'rgba(11,13,12,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #1e2a24' }}>
          <Cpu size={20} color="#3bf185" />
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.3 }}>LocalHost-AI</span>
          <StarBorder onClick={onEnter} color="#3bf185" thickness={1} speed="6s" innerClassName="!py-2 !px-5 !text-xs !bg-[#0b0d0c] !rounded-[10px] hover:!text-[#3bf185]">
            Open Chat →
          </StarBorder>
        </header>

        {/* Hero */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}
          style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(59,241,133,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Orb */}
          <motion.div animate={{ boxShadow: ['0 0 60px rgba(59,241,133,0.12)', '0 0 90px rgba(59,241,133,0.25)', '0 0 60px rgba(59,241,133,0.12)'] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            style={{ width: 200, height: 200, borderRadius: 28, background: 'linear-gradient(145deg, #0f1612, #0a0e0c)', border: '1px solid #1e2a24', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 44 }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #1a3d2a, #0a1f14 60%, #050d09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={42} color="#3bf185" strokeWidth={1.5} style={{ opacity: 0.7 }} />
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(30px, 5vw, 48px)', fontWeight: 600, lineHeight: 1.15, marginBottom: 18, maxWidth: 560 }}>
            Your AI. Your Hardware.<br /><span style={{ color: '#3bf185' }}>100% Private.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            style={{ color: '#7a8f83', fontSize: 15, maxWidth: 440, marginBottom: 36, lineHeight: 1.7 }}>
            Experience premium offline intelligence with LocalHost-AI. No cloud. No tracking. Just raw performance on your local machine.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StarBorder onClick={onEnter} color="#3bf185" thickness={1.5} speed="4s" innerClassName="!py-3.5 !px-9 !text-sm !bg-[#3bf185] !text-[#0a2f1a] hover:!bg-[#2fe578] font-bold !rounded-[14px]">
              Get Started <ArrowRight size={18} />
            </StarBorder>
            <a href="https://github.com/Yash-Marathe91/LocalHost-AI" target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 36px', background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 15, border: '1px solid #1e2a24', borderRadius: 14, cursor: 'pointer', textDecoration: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              View on GitHub
            </a>
          </motion.div>
        </motion.section>

        {/* Features */}
        <section style={{ padding: '0 24px 80px', maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[
            { icon: <Shield size={22} color="#3bf185" />, title: 'Privacy First', desc: 'Fully air-gapped inference. Your data never leaves your machine.' },
            { icon: <Zap size={22} color="#3bf185" />, title: 'Hyper-Fast', desc: 'Low-latency responses powered by your local GPU/CPU.' },
            { icon: <SlidersHorizontal size={22} color="#3bf185" />, title: 'Total Control', desc: 'Manage GGUF models, context windows, and RAM allocation.' },
            { icon: <Database size={22} color="#3bf185" />, title: 'Context Savvy', desc: 'Integrated memory vault for smarter local knowledge.' },
          ].map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ background: '#111614', border: '1px solid #1e2a24', borderRadius: 16, padding: 28 }}>
              <div style={{ width: 44, height: 44, background: '#0a2f1a', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: '#7a8f83', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ))}
        </section>

        {/* System Monitor */}
        <section style={{ padding: '0 24px 80px', maxWidth: 800, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ background: '#111614', border: '1px solid #1e2a24', borderRadius: 16, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#3bf185', boxShadow: '0 0 8px rgba(59,241,133,0.5)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#3bf185' }}>System Monitor</span>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: '#4a5c53' }}>Live Telemetry</span>
            </div>
            <div style={{ fontSize: 13, color: '#7a8f83', marginBottom: 8 }}>Inference Speed</div>
            <div style={{ fontSize: 48, fontWeight: 800, color: '#3bf185', lineHeight: 1, marginBottom: 20 }}>12.4 <span style={{ fontSize: 20, fontWeight: 500, color: '#7a8f83' }}>t/s</span></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 24 }}>
              {[30, 50, 65, 80, 95].map((h, i) => (
                <motion.div key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.15, duration: 0.8 }}
                  style={{ flex: 1, borderRadius: '6px 6px 2px 2px', background: 'linear-gradient(to top, #3bf185, #2bb86a)', opacity: 0.7 }} />
              ))}
            </div>
            <div style={{ height: 3, background: '#3bf185', borderRadius: 3, marginBottom: 24 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[{ label: 'VRAM Usage', val: '6.2 / 8.0 GB', pct: 77.5 }, { label: 'CPU Load', val: '22% Peak', pct: 22 }].map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: 12, color: '#7a8f83', marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{m.val}</div>
                  <div style={{ height: 6, borderRadius: 6, background: 'rgba(59,241,133,0.1)' }}>
                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${m.pct}%` }} viewport={{ once: true }} transition={{ delay: 0.8, duration: 1.2 }}
                      style={{ height: '100%', borderRadius: 6, background: '#3bf185' }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* CTA */}
        <section style={{ padding: '0 24px 80px', maxWidth: 800, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ background: '#111614', border: '1px solid #1a3d2a', borderRadius: 16, padding: '48px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle at center, rgba(59,241,133,0.04), transparent 60%)', pointerEvents: 'none' }} />
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, position: 'relative' }}>Ready to go local?</h2>
            <p style={{ color: '#7a8f83', fontSize: 14, marginBottom: 32, position: 'relative' }}>Start chatting with your private AI — zero setup, zero cloud.</p>
            <StarBorder onClick={onEnter} color="#3bf185" thickness={1.5} speed="4s" innerClassName="!py-3.5 !px-9 !text-sm !bg-[#3bf185] !text-[#0a2f1a] hover:!bg-[#2fe578] font-bold !rounded-[14px]">
              Launch Chatbot <ArrowRight size={18} />
            </StarBorder>
          </motion.div>
        </section>

        {/* Footer */}
        <footer style={{ padding: '40px 24px 32px', maxWidth: 800, margin: '0 auto', borderTop: '1px solid #1e2a24' }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>LocalHost-AI</div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
            <a href="https://github.com/Yash-Marathe91/LocalHost-AI" target="_blank" rel="noreferrer" style={{ color: '#7a8f83', fontSize: 13, textDecoration: 'none' }}>GitHub</a>
            <a href="#" style={{ color: '#7a8f83', fontSize: 13, textDecoration: 'none' }}>Changelog</a>
            <a href="#" style={{ color: '#7a8f83', fontSize: 13, textDecoration: 'none' }}>Privacy Policy</a>
          </div>
          <div style={{ fontSize: 12, color: '#4a5c53' }}>© 2024 LocalHost-AI. Engineering for the edge.</div>
        </footer>
      </div>
    </div>
  );
}
