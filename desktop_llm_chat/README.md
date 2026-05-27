# 💻 LocalHost-AI Desktop Client

The premium desktop frontend for **LocalHost-AI** — built with **React 19**, **Vite 8**, **Tailwind CSS v4**, and **Electron 42**.

Connects to your local llama.cpp server at `127.0.0.1:8080` for fully offline, privacy-first AI chat.

---

## ✨ Features

- **Three Inference Modes:**
  - ⚡ **Quick** — Concise answers (512 tokens, temp 0.7)
  - 🧠 **Reasoning** — Step-by-step logic (1024 tokens, temp 0.5)
  - ✍️ **Writing** — Long-form Markdown output (2048 tokens, temp 0.7)
- **Typewriter Animation** — Responses type out with a blinking cursor; click to skip
- **Streaming & Instant** — Toggle real-time token streaming or batch delivery
- **Markdown + Code Highlighting** — Prism OneDark syntax theme
- **Context Memory** — Persistent conversation history via `localStorage`
- **Smart Anti-Repetition** — Llama-3 native chat template with deduplication rules
- **Chat Export** — Download sessions as `.md` files with metadata
- **100% Offline SVG Icons** — Lucide React icons, zero external font downloads

---

## 🛠 Commands

```bash
# Install dependencies
npm install

# Development (Vite + Electron)
npm run dev

# Production build
npm run build

# Package as portable .exe
npm run dist
```

---

## 📂 Source Structure

```
src/
├── main.tsx                 # React entry point
├── App.tsx                  # Main chat UI, LLM connection, state management
├── config.tsx               # Inference modes, Llama-3 prompt builder
├── memory.ts                # localStorage persistence with smart truncation
├── TypewriterContent.tsx    # Typewriter animation with Markdown rendering
└── index.css                # Tailwind v4 theme (Matte Black + Inference Green)
```

---

## 🛡 Privacy

- **Zero Telemetry** — No analytics, no tracking, no external calls
- **Localhost Only** — All API traffic routed to `127.0.0.1`
- **Your Data, Your Machine** — Nothing ever leaves your hardware
