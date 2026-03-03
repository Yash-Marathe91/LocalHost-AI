🧠 LocalHost-AI

Fully Offline On-Device LLM using Flutter + llama.cpp

🚀 LocalHost-AI is a privacy-first, fully offline AI assistant powered by llama.cpp and built with a high-performance Flutter desktop frontend.



The Philosophy: No cloud. No API keys. No internet dependency. Everything runs locally on your machine.



🔥 Why This Project?

Most AI assistants depend on cloud APIs, which introduces several critical friction points:



❌ Internet Required: Zero functionality without a connection.



❌ Privacy Risks: User data is sent to and stored on external servers.



❌ API Costs: Recurring fees and usage limits.



❌ Dependency: You don't own the intelligence you use.



LocalHost-AI solves this by running a Large Language Model entirely on-device, giving you total sovereignty over your data and AI.



🏗 Architecture Overview

Code snippet

graph TD

&nbsp;   A\[Flutter UI: Chat Interface \& Controls] -->|HTTP localhost| B\[llama.cpp Server]

&nbsp;   B --> C\[Meta-Llama-3 8B GGUF]

&nbsp;   C --> D\[CPU / GPU Optional]

&nbsp;   D --> E((Fully Offline))

⚙ Tech Stack

Frontend: 🖥 Flutter (Windows Desktop UI)



Inference Engine: 🧠 llama.cpp



Model: 📦 GGUF Quantized (Meta-Llama-3-8B-Instruct Q4\_K\_M)



Storage: 💾 Local Persistent Memory (JSON)



Communication: 🌐 HTTP localhost



✨ Features

📴 Fully Offline

Runs entirely on 127.0.0.1 with zero external calls.



🧠 Persistent Memory

Context is preserved! Stores previous interactions locally in memory.json.



⚡ Performance Modes

Streaming: Real-time token generation for a natural feel.



Instant: Fast, full-response delivery.



🧩 Task-Specific Modes

Quick: Concise, short answers.



Reasoning: Deep-dive, step-by-step logic.



Writing: Beautifully structured Markdown output.



🔐 Privacy First

Your data never leaves your physical hardware.



🧹 Granular Controls

Enable/Disable memory on the fly.



Wipe local memory or start fresh sessions instantly.



📊 Real-time Metrics

Monitor your performance with:



Latency (ms)



Character output count



Token budget tracking



🖥 Getting Started

1\. Running The LLM (CPU Mode)

Navigate to your llama.cpp directory:



Bash

cd C:\\testLlama\\llama.cpp

Start the local server:



Bash

build\\bin\\Release\\llama-server.exe ^

&nbsp; -m models\\Meta-Llama-3-8B-Instruct-Q4\_K\_M.gguf ^

&nbsp; -ngl 0 ^

&nbsp; -c 4096 ^

&nbsp; --host 127.0.0.1 ^

&nbsp; --port 8080

Note: -ngl 0 ensures execution happens on the CPU.



2\. Launching the Flutter App

Inside the project root folder:



Bash

\# Fetch dependencies

flutter pub get



\# Run on Windows

flutter run -d windows

The app connects automatically to: http://127.0.0.1:8080/completion



📂 Project Structure

Plaintext

lib/

&nbsp; ├── main.dart             # UI and State Logic

&nbsp; └── memory\_service.dart   # Local JSON persistence

windows/                    # Native Windows config

README.md                   # Documentation

pubspec.yaml                # Flutter Dependencies

🧠 Model Information

Model: Meta-Llama-3-8B-Instruct (Quantized Q4\_K\_M)



Format: GGUF



\[!WARNING]



Model files are not included in this repository due to size. Download the weights manually and place them in the models/ directory.



📌 Use Cases

Low-connectivity environments: Work anywhere.



Privacy-critical systems: Legal, medical, or personal journaling.



On-device enterprise AI: Secure internal knowledge bases.



Edge AI deployments: Lightweight hardware implementations.



🔒 Privacy Statement

This system is designed to be a "black box" on your desk:



NO requests to external APIs.



NO external data logging.



LOCAL memory storage only.



LOCALHOST traffic only.



🚀 Future Improvements

\[ ] File upload \& RAG (Retrieval-Augmented Generation) support.



\[ ] In-app Model Selector UI.



\[ ] Multi-session chat history.



\[ ] Voice-to-Text and Text-to-Voice integration.



\[ ] Advanced Settings panel for temperature/top-p tuning.



🏆 Hackathon Submission

Challenge: DeepSeek vs. Llama – "Kill The Cloud" Challenge



Theme: Deploying powerful AI systems without relying on centralized cloud infrastructure.



Author: Yash Marathe



⭐ Final Statement

LocalHost-AI demonstrates that advanced AI assistants can operate securely, privately, and efficiently — entirely offline.



The cloud is optional. Intelligence is not.

