# 💻 LocalHost-AI Desktop Workspace

A premium, fully offline, privacy-first AI desktop chat client powered by **React 19**, **Vite 8**, **Tailwind CSS v4**, and **Electron 42**.

This workspace is designed to connect directly with your local inference server (e.g., `llama.cpp` or Ollama running on `127.0.0.1:8080`) to provide high-performance generative UI and real-time streaming with zero data ever leaving your machine.

---

## ✨ Features

- 🔋 **Three Optimized Inference Modes:**
  - **Quick:** Highly optimized for brief, snappy completions (128 max tokens, temp 0.7)
  - **Reasoning:** Enforces step-by-step logical planning (384 max tokens, temp 0.5)
  - **Writing:** Perfect for structured long-form drafts and Markdown (512 max tokens, temp 0.7)
- 📝 **Markdown rendering & Code Syntax Highlight:** Beautifully renders markdown structure, lists, mathematical notation, and highlighted code blocks using the **Prism OneDark** theme.
- 💾 **Context Memory Integration:** Remembers your chat session context and automatically appends relevant session context history (backed by `localStorage` persistence).
- 📤 **Premium Chat Export:** Export the current active session in one click as a beautifully formatted Markdown (`.md`) file including metadata such as mode settings, generation time, and char length.
- 📦 **100% Offline SVG Rendering:** Uses direct vector SVG paths via `lucide-react`. No fonts, Material Icons, or external files are ever downloaded or needed, meaning zero square-box rendering glitches.

---

## 🛠️ Development & Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
Launches the hot-reloading Vite dev compiler and the Electron frame concurrently:
```bash
npm run dev
```

### 3. Build Static Assets
```bash
npm run build
```

### 4. Build Standalone Portable Executable (.exe)
Compiles static components and packages the application into a single-file, zero-installer portable executable file:
```bash
npm run dist
```
The output executable will be placed inside the `dist-electron/` directory. You can distribute this `.exe` file to run the app offline on any Windows machine without needing Node.js or a terminal!

---

## 🛡️ Privacy & Compliance
- **Zero Telemetry:** The app operates on pure local sandboxed networks.
- **Direct Connect:** API calls are routed entirely locally to `127.0.0.1`.
