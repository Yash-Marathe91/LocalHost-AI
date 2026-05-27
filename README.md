# 🧠 LocalHost-AI

### Fully Offline On-Device LLM Desktop Application

> **The cloud is optional. Intelligence is not.**

LocalHost-AI is a **privacy-first, fully offline AI assistant** powered by [llama.cpp](https://github.com/ggerganov/llama.cpp) and built with a premium **React + Electron** desktop frontend. Everything runs locally on your machine — no cloud, no API keys, no internet dependency.

---

## 🔥 Why This Project?

Most AI assistants depend on cloud APIs, which introduces critical problems:

| Problem | LocalHost-AI Solution |
|---|---|
| ❌ Internet Required | ✅ Runs 100% offline on `127.0.0.1` |
| ❌ Privacy Risks | ✅ Data never leaves your hardware |
| ❌ API Costs | ✅ Free forever — you own the model |
| ❌ Vendor Lock-in | ✅ Full sovereignty over your AI |

---

## 🏗 Architecture

```
┌──────────────────────────────┐
│   React + Electron Desktop   │
│   (Tailwind CSS v4 + Framer) │
└──────────┬───────────────────┘
           │ HTTP POST (localhost)
           ▼
┌──────────────────────────────┐
│     llama.cpp Server         │
│     127.0.0.1:8080           │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Meta-Llama-3-8B-Instruct    │
│  (GGUF Q4_K_M · ~4.7 GB)    │
└──────────────────────────────┘
         CPU / GPU
```

---

## ⚙ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 · TypeScript · Tailwind CSS v4 |
| **Desktop Shell** | Electron 42 · Vite 8 |
| **Animations** | Framer Motion · Custom Typewriter Effect |
| **Inference Engine** | llama.cpp (local HTTP server) |
| **Model** | Meta-Llama-3-8B-Instruct (GGUF Q4_K_M) |
| **Storage** | Browser localStorage (persistent memory) |
| **Communication** | HTTP on `127.0.0.1:8080` — zero external calls |

---

## ✨ Features

### 🎯 Three Inference Modes
- **⚡ Quick** — Fast, concise answers (512 tokens, temp 0.7)
- **🧠 Reasoning** — Step-by-step logical analysis (1024 tokens, temp 0.5)
- **✍️ Writing** — Long-form, structured Markdown output (2048 tokens, temp 0.7)

### 💬 Smart Chat Experience
- **Typewriter Animation** — Responses type out naturally with a blinking cursor (click to skip)
- **Streaming & Instant Modes** — Toggle real-time token streaming or full-response delivery
- **Markdown & Code Highlighting** — Beautiful rendering with Prism OneDark theme
- **Copy Button** — One-click copy on any assistant message

### 🧠 Context Memory
- **Persistent Memory** — Remembers conversation context across sessions via `localStorage`
- **Smart Truncation** — Long responses are summarized before storing to save context tokens
- **Anti-Repetition** — Llama-3 chat template with explicit deduplication rules
- **Toggle On/Off** — Enable or disable memory on the fly

### 📤 Export & Controls
- **Chat Export** — Download any session as a formatted Markdown (`.md`) file
- **New Session** — Clear chat and start fresh instantly
- **Clear Memory** — Wipe all stored context with one click
- **Real-time Metrics** — Live latency (ms), character count, and token budget display

### 🔐 Privacy First
- Zero telemetry — no analytics, no tracking
- Zero external API calls — all traffic stays on `127.0.0.1`
- Zero cloud dependency — runs in airplane mode

---

## 🖥 Getting Started

### Prerequisites
- **Node.js** v18+ (for the frontend)
- **llama.cpp** compiled with `llama-server` ([build instructions](https://github.com/ggerganov/llama.cpp#build))
- **GGUF model file** (e.g., `Meta-Llama-3-8B-Instruct-Q4_K_M.gguf`)

### 1. Start the LLM Server

```bash
cd C:\testLlama\llama.cpp

build\bin\Release\llama-server.exe ^
  -m models\Meta-Llama-3-8B-Instruct-Q4_K_M.gguf ^
  -ngl 0 ^
  -t 8 ^
  -c 4096 ^
  --host 127.0.0.1 ^
  --port 8080
```

> **Note:** `-ngl 0` runs on CPU only. Set `-ngl 99` to offload layers to GPU if available.

### 2. Launch the Desktop App

```bash
cd desktop_llm_chat

# Install dependencies (first time only)
npm install

# Start the dev server + Electron window
npm run dev
```

The app connects automatically to `http://127.0.0.1:8080/completion`.

### 3. Build Portable Executable (Optional)

```bash
npm run dist
```

Produces a standalone `.exe` in `dist-electron/` — no Node.js or terminal needed to run!

---

## 📂 Project Structure

```
Kill_the_cloud/
├── .gitignore
├── README.md                          # This file
└── desktop_llm_chat/                  # Electron + React application
    ├── main.cjs                       # Electron main process
    ├── index.html                     # Entry HTML
    ├── package.json                   # Dependencies & build config
    ├── vite.config.ts                 # Vite + Tailwind v4 config
    ├── src/
    │   ├── main.tsx                   # React entry point
    │   ├── App.tsx                    # Main chat UI & logic
    │   ├── config.tsx                 # Inference modes & Llama-3 prompt builder
    │   ├── memory.ts                  # localStorage persistence service
    │   ├── TypewriterContent.tsx      # Typewriter animation component
    │   └── index.css                  # Tailwind v4 theme tokens
    └── public/                        # Static assets
```

---

## 🧠 Model Information

| Property | Value |
|---|---|
| **Model** | Meta-Llama-3-8B-Instruct |
| **Quantization** | Q4_K_M (~4.7 GB) |
| **Format** | GGUF |
| **Context Window** | 4096 tokens |
| **Prompt Format** | Llama-3 native chat template |

> [!WARNING]
> Model files are **not included** in this repository due to size. Download the weights from [HuggingFace](https://huggingface.co/meta-llama) and place them in your llama.cpp `models/` directory.

---

## 📌 Use Cases

- 🏔 **Low-connectivity environments** — Work anywhere, no internet needed
- 🔒 **Privacy-critical systems** — Legal, medical, or personal journaling
- 🏢 **On-device enterprise AI** — Secure internal knowledge without cloud exposure
- ⚡ **Edge AI deployments** — Lightweight hardware implementations

---

## 🚀 Future Improvements

- [ ] File upload & RAG (Retrieval-Augmented Generation) support
- [ ] In-app Model Selector UI
- [ ] Multi-session chat history with tabs
- [ ] Voice-to-Text and Text-to-Voice integration
- [ ] Custom temperature/top-p sliders in settings
- [ ] GPU auto-detection and layer offloading

---

## 🏆 Hackathon Submission

**Challenge:** DeepSeek vs. Llama — *"Kill The Cloud"* Challenge

**Theme:** Deploying powerful AI systems without relying on centralized cloud infrastructure.

**Author:** [Yash Marathe](https://github.com/Yash-Marathe91)

---

> *LocalHost-AI demonstrates that advanced AI assistants can operate securely, privately, and efficiently — entirely offline.*
>
> **The cloud is optional. Intelligence is not.** 🧠
