\# 🧠 LocalHost-AI  

\### Fully Offline On-Device LLM using Flutter + llama.cpp  



🚀 A privacy-first, fully offline AI assistant powered by \*\*llama.cpp\*\* and built with a \*\*Flutter desktop frontend\*\*.



No cloud.  

No API keys.  

No internet dependency.  



Everything runs locally on your machine.



---



\## 🔥 Why This Project?



Most AI assistants depend on cloud APIs, which means:



\- ❌ Internet required  

\- ❌ User data sent to servers  

\- ❌ API costs  

\- ❌ Privacy risks  



\*\*LocalHost-AI solves this\*\* by running a Large Language Model entirely on-device.



---



\## 🏗 Architecture Overview





┌──────────────────────────────┐

│ Flutter UI │

│ (Chat Interface + Controls) │

└──────────────┬───────────────┘

│ HTTP (localhost)

▼

┌──────────────────────────────┐

│ llama.cpp Server │

│ Meta-Llama-3 8B (GGUF) │

│ CPU / GPU Optional │

└──────────────┬───────────────┘

▼

Fully Offline





---



\## ⚙ Tech Stack



\- 🖥 Flutter (Windows Desktop UI)

\- 🧠 llama.cpp

\- 📦 GGUF Quantized Model (Meta-Llama-3-8B-Instruct Q4\_K\_M)

\- 💾 Local Persistent Memory (JSON)

\- 🌐 HTTP localhost communication



---



\## ✨ Features



\### 📴 Fully Offline

Runs entirely on `127.0.0.1` with no internet dependency.



\### 🧠 Persistent Memory

Stores previous interactions locally in `memory.json`.



\### ⚡ Streaming + Instant Modes

Switch between real-time token streaming or fast full-response mode.



\### 🧩 Task Modes

\- Quick (Short answers)

\- Reasoning (Step-by-step)

\- Writing (Structured Markdown)



\### 🔐 Privacy First

No data leaves the device.



\### 🧹 Memory Controls

\- Enable / Disable memory

\- Clear memory

\- Start new chat session



\### 📊 Performance Metrics

Displays:

\- Latency (ms)

\- Output characters

\- Token budget



---



\## 🖥 Running The LLM (CPU Only Mode)



Navigate to llama.cpp folder:



```bash

cd C:\\testLlama\\llama.cpp



Run server:



build\\bin\\Release\\llama-server.exe ^

&nbsp; -m models\\Meta-Llama-3-8B-Instruct-Q4\_K\_M.gguf ^

&nbsp; -ngl 0 ^

&nbsp; -c 4096 ^

&nbsp; --host 127.0.0.1 ^

&nbsp; --port 8080



-ngl 0 ensures CPU-only execution



▶ Running Flutter App



Inside project folder:



flutter pub get

flutter run -d windows



The app will connect to:



http://127.0.0.1:8080/completion

📂 Project Structure

lib/

&nbsp; main.dart

&nbsp; memory\_service.dart



windows/

android/

ios/

web/



README.md

pubspec.yaml

.gitignore

🧠 Model Information



Model used:

Meta-Llama-3-8B-Instruct (Quantized Q4\_K\_M)



⚠ Model files are not included in this repo.

Download manually and place inside:



models/

📌 Use Cases



Low-connectivity environments



Privacy-critical systems



On-device enterprise AI



Offline academic tools



Edge AI deployments



🔒 Privacy Statement



This system:



Does NOT send requests to external APIs



Does NOT log data externally



Stores memory locally only



Runs entirely on localhost



🚀 Future Improvements



File upload \& RAG support



Model selector UI



Multi-session chat history



Voice input/output



Settings panel



🏆 Hackathon Submission



Built for:

DeepSeek vs. Llama – "Kill The Cloud" Challenge



Theme:

Deploy powerful AI systems without relying on centralized cloud infrastructure.



👨‍💻 Author



Yash Marathe

GitHub: https://github.com/Yash-Marathe91



⭐ Final Statement



LocalHost-AI demonstrates that advanced AI assistants can operate

securely, privately, and efficiently — entirely offline.



The cloud is optional.

Intelligence is not.





---



\# ✅ What To Do Now



1\. Go to your GitHub repo  

2\. Click `README.md`  

3\. Click Edit  

4\. Replace everything  

5\. Commit changes  



---



If you want, I can now also:

\- Make it more technical

\- Make it more startup-style

\- Or make it more hackathon-pitch focused 🔥

