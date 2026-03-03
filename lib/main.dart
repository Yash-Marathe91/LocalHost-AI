import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_markdown/flutter_markdown.dart';
import 'memory_service.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Offline Local LLM',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0E0E0E),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF141414),
          elevation: 0,
        ),
      ),
      home: const ChatPage(),
    );
  }
}

class ChatMessage {
  final String role;
  String content;

  ChatMessage(this.role, this.content);
}

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessage> messages = [];

  bool loading = false;

  /// MODES
  String selectedMode = "Quick";
  final List<String> modes = ["Quick", "Reasoning", "Writing"];

  /// FEATURE TOGGLES
  bool streamingEnabled = false;
  bool memoryEnabled = true;

  /// UI STATE
  int selectedRailIndex = 0;
  bool showSettings = false;

  /// METRICS
  int lastLatencyMs = 0;
  int lastCharCount = 0;

  /// TOKEN BUDGETS
  final Map<String, int> tokenBudget = {
    "Quick": 128,
    "Reasoning": 384,
    "Writing": 512,
  };

  /// PROMPT BUILDER
  String buildPrompt(String userInput) {
    final memory = memoryEnabled ? MemoryService.getRecentMemory(6) : [];

    final memoryText = memory.isEmpty
        ? "Memory disabled or empty."
        : memory.map((m) => "- ${m['role']}: ${m['content']}").join("\n");

    String modeInstruction;
    switch (selectedMode) {
      case "Reasoning":
        modeInstruction =
            "Think step by step and explain your reasoning clearly.";
        break;
      case "Writing":
        modeInstruction =
            "Write a structured, well-formatted response using Markdown.";
        break;
      default:
        modeInstruction = "Give a short, direct, concise answer.";
    }

    return '''
You are a fully offline personal AI assistant running locally.

Mode: $selectedMode
Instruction: $modeInstruction

Rules:
- Respond ONLY once
- Do NOT ask questions
- Do NOT include role labels
- Use Markdown only if useful

Memory Status: ${memoryEnabled ? "ENABLED" : "DISABLED"}

Private Memory:
$memoryText

User Query:
$userInput

Assistant:
''';
  }

  /// SEND PROMPT
  Future<void> sendPrompt() async {
    final userText = _controller.text.trim();
    if (userText.isEmpty) return;

    setState(() {
      messages.add(ChatMessage("user", userText));
      messages.add(ChatMessage("assistant", ""));
      loading = true;
      _controller.clear();
    });

    _autoScroll();

    if (memoryEnabled) {
      MemoryService.addMessage("user", userText);
    }

    streamingEnabled
        ? _streamResponse(userText)
        : _instantResponse(userText);
  }

  /// INSTANT RESPONSE
  Future<void> _instantResponse(String userText) async {
    final start = DateTime.now();

    final response = await http.post(
      Uri.parse('http://127.0.0.1:8080/completion'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'prompt': buildPrompt(userText),
        'n_predict': tokenBudget[selectedMode],
        'temperature': selectedMode == "Reasoning" ? 0.5 : 0.7,
        'stop': ['User:', 'Assistant:'],
        'stream': false,
      }),
    );

    final data = jsonDecode(response.body);
    final reply = (data['content'] ?? '').trim();

    setState(() {
      messages.last.content = reply;
      loading = false;
      lastLatencyMs =
          DateTime.now().difference(start).inMilliseconds;
      lastCharCount = reply.length;
    });

    if (memoryEnabled) {
      MemoryService.addMessage("assistant", reply);
    }

    _autoScroll();
  }

  /// STREAMING RESPONSE
  Future<void> _streamResponse(String userText) async {
    final start = DateTime.now();

    final request = http.Request(
      'POST',
      Uri.parse('http://127.0.0.1:8080/completion'),
    );

    request.headers['Content-Type'] = 'application/json';
    request.body = jsonEncode({
      'prompt': buildPrompt(userText),
      'n_predict': tokenBudget[selectedMode],
      'temperature': selectedMode == "Reasoning" ? 0.5 : 0.7,
      'stop': ['User:', 'Assistant:'],
      'stream': true,
    });

    final streamedResponse = await request.send();

    String buffer = "";
    String fullText = "";
    DateTime lastUpdate = DateTime.now();

    await for (final chunk in streamedResponse.stream.transform(utf8.decoder)) {
      final lines = chunk.split('\n');

      for (final line in lines) {
        if (!line.startsWith('data:')) continue;
        if (line.contains('[DONE]')) break;

        final jsonPart =
            jsonDecode(line.replaceFirst('data:', '').trim());
        final token = jsonPart['content'] ?? '';

        buffer += token;
        fullText += token;

        if (DateTime.now().difference(lastUpdate).inMilliseconds > 60) {
          setState(() {
            messages.last.content += buffer;
            buffer = "";
            lastUpdate = DateTime.now();
          });
          _autoScroll();
        }
      }
    }

    if (buffer.isNotEmpty) {
      setState(() {
        messages.last.content += buffer;
      });
    }

    setState(() {
      loading = false;
      lastLatencyMs =
          DateTime.now().difference(start).inMilliseconds;
      lastCharCount = fullText.length;
    });

    if (memoryEnabled) {
      MemoryService.addMessage("assistant", fullText.trim());
    }

    _autoScroll();
  }

  /// AUTO SCROLL
  void _autoScroll() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  /// CLEAR CHAT SESSION
  void _newChat() {
    setState(() {
      messages.clear();
      lastLatencyMs = 0;
      lastCharCount = 0;
    });
  }

  /// CLEAR MEMORY
  void _clearMemory() {
    MemoryService.clearMemory();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("Memory cleared")),
    );
  }

  /// SETTINGS DIALOG
  void _openSettings() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text("Settings"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SwitchListTile(
              title: const Text("Streaming Responses"),
              value: streamingEnabled,
              onChanged: (v) => setState(() => streamingEnabled = v),
            ),
            SwitchListTile(
              title: const Text("Memory"),
              value: memoryEnabled,
              onChanged: (v) {
                setState(() => memoryEnabled = v);
                MemoryService.setEnabled(v);
              },
            ),
            DropdownButtonFormField<String>(
              initialValue: selectedMode,
              decoration: const InputDecoration(labelText: "Mode"),
              items: modes
                  .map((m) =>
                      DropdownMenuItem(value: m, child: Text(m)))
                  .toList(),
              onChanged: (v) => setState(() => selectedMode = v!),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Close"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            backgroundColor: const Color(0xFF141414),
            selectedIndex: selectedRailIndex,
            onDestinationSelected: (i) {
              setState(() => selectedRailIndex = i);
              if (i == 1) _newChat();
              if (i == 2) _openSettings();
            },
            destinations: const [
              NavigationRailDestination(
                icon: Icon(Icons.chat),
                label: Text("Chat"),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.history),
                label: Text("New"),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.settings),
                label: Text("Settings"),
              ),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: Column(
              children: [
                AppBar(
                  title: const Text("Offline Personal AI"),
                  actions: [
                    IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: _clearMemory,
                    ),
                  ],
                ),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(6),
                  color: Colors.black26,
                  child: const Text(
                    "🛜 Local LLM · llama.cpp · CPU/GPU Optional",
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.greenAccent),
                  ),
                ),
                if (!loading && lastLatencyMs > 0)
                  Padding(
                    padding: const EdgeInsets.all(6),
                    child: Text(
                      "⚡ ${lastLatencyMs}ms | ✍ $lastCharCount chars | 🔢 ${tokenBudget[selectedMode]} tokens",
                      style: const TextStyle(
                          fontSize: 12, color: Colors.greenAccent),
                    ),
                  ),
                Expanded(
                  child: ListView.builder(
                    controller: _scrollController,
                    itemCount: messages.length,
                    itemBuilder: (_, i) {
                      final msg = messages[i];
                      return Padding(
                        padding: const EdgeInsets.all(10),
                        child: msg.role == "user"
                            ? Align(
                                alignment: Alignment.centerRight,
                                child: Container(
                                  constraints:
                                      const BoxConstraints(maxWidth: 600),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: Colors.blueGrey.shade700,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(msg.content),
                                ),
                              )
                            : Align(
                                alignment: Alignment.centerLeft,
                                child: Container(
                                  constraints:
                                      const BoxConstraints(maxWidth: 600),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade900,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: MarkdownBody(
                                    data: msg.content,
                                    selectable: true,
                                  ),
                                ),
                              ),
                      );
                    },
                  ),
                ),
                if (loading)
                  const Padding(
                    padding: EdgeInsets.all(8),
                    child: LinearProgressIndicator(),
                  ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  color: const Color(0xFF141414),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _controller,
                          minLines: 1,
                          maxLines: 4,
                          decoration: const InputDecoration(
                            hintText: "Type a message…",
                            border: OutlineInputBorder(),
                          ),
                          onSubmitted: (_) => sendPrompt(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(Icons.send),
                        onPressed: sendPrompt,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
