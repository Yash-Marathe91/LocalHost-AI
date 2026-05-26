import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'memory_service.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LocalHost-AI Workspace',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0A0A0A),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
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
        modeInstruction = "Think step by step and explain your reasoning clearly.";
        break;
      case "Writing":
        modeInstruction = "Write a structured, well-formatted response using Markdown.";
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

    streamingEnabled ? _streamResponse(userText) : _instantResponse(userText);
  }

  /// INSTANT RESPONSE
  Future<void> _instantResponse(String userText) async {
    final start = DateTime.now();

    try {
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
        lastLatencyMs = DateTime.now().difference(start).inMilliseconds;
        lastCharCount = reply.length;
      });

      if (memoryEnabled) {
        MemoryService.addMessage("assistant", reply);
      }
    } catch (e) {
      setState(() {
        messages.last.content = "Error connecting to local LLM.";
        loading = false;
      });
    }

    _autoScroll();
  }

  /// STREAMING RESPONSE
  Future<void> _streamResponse(String userText) async {
    final start = DateTime.now();

    try {
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

          final jsonPart = jsonDecode(line.replaceFirst('data:', '').trim());
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
        lastLatencyMs = DateTime.now().difference(start).inMilliseconds;
        lastCharCount = fullText.length;
      });

      if (memoryEnabled) {
        MemoryService.addMessage("assistant", fullText.trim());
      }
    } catch (e) {
      setState(() {
        messages.last.content = "Error connecting to local LLM.";
        loading = false;
      });
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

  /// SETTINGS DIALOG
  void _openSettings() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF333333))),
        title: Text("Workspace Settings",
            style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SwitchListTile(
              activeColor: const Color(0xFF00E676),
              title: const Text("Streaming Responses"),
              value: streamingEnabled,
              onChanged: (v) => setState(() => streamingEnabled = v),
            ),
            SwitchListTile(
              activeColor: const Color(0xFF00E676),
              title: const Text("Context Memory"),
              value: memoryEnabled,
              onChanged: (v) {
                setState(() => memoryEnabled = v);
                MemoryService.setEnabled(v);
              },
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              dropdownColor: const Color(0xFF262626),
              initialValue: selectedMode,
              decoration: const InputDecoration(
                labelText: "Inference Mode",
                border: OutlineInputBorder(),
                focusedBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: Color(0xFF00E676))),
              ),
              items: modes
                  .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                  .toList(),
              onChanged: (v) => setState(() => selectedMode = v!),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () {
                MemoryService.clearMemory();
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text("Memory cleared successfully."),
                    backgroundColor: Color(0xFF262626),
                  ),
                );
              },
              child: const Text("Clear Global Memory",
                  style: TextStyle(color: Colors.redAccent)),
            )
          ],
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00E676),
              foregroundColor: const Color(0xFF003918),
            ),
            onPressed: () => Navigator.pop(context),
            child: const Text("Done"),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebarItem(int index, IconData icon, String label) {
    final isActive = selectedRailIndex == index;
    return InkWell(
      onTap: () {
        setState(() => selectedRailIndex = index);
        if (index == 1) _newChat();
        if (index == 2) _openSettings();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
        decoration: BoxDecoration(
          border: Border(
            left: BorderSide(
              color: isActive ? const Color(0xFF00E676) : Colors.transparent,
              width: 3,
            ),
          ),
          color: isActive ? const Color(0xFF00E676).withOpacity(0.05) : Colors.transparent,
        ),
        child: Row(
          children: [
            Icon(icon, color: isActive ? const Color(0xFF00E676) : Colors.white70, size: 20),
            const SizedBox(width: 16),
            Text(
              label.toUpperCase(),
              style: GoogleFonts.jetBrainsMono(
                color: isActive ? const Color(0xFF00E676) : Colors.white70,
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                letterSpacing: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          // FIXED SIDEBAR (280px)
          Container(
            width: 280,
            decoration: const BoxDecoration(
              color: Color(0xFF1A1A1A),
              border: Border(right: BorderSide(color: Color(0xFF333333))),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "LocalHost-AI",
                        style: GoogleFonts.inter(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "OFFLINE WORKSPACE",
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 10,
                          color: Colors.white54,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _buildSidebarItem(0, Icons.terminal, "Workspace"),
                _buildSidebarItem(1, Icons.add_box_outlined, "New Session"),
                _buildSidebarItem(2, Icons.tune, "Parameters"),
                const Spacer(),
                
                // INFERENCE STATUS (Animated)
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: loading ? const Color(0xFF00E676) : Colors.white24,
                          shape: BoxShape.circle,
                        ),
                      )
                          .animate(
                            target: loading ? 1 : 0,
                            onPlay: (controller) => controller.repeat(reverse: true),
                          )
                          .fade(duration: 800.ms, begin: 0.2, end: 1.0)
                          .scale(begin: const Offset(0.8, 0.8), end: const Offset(1.2, 1.2)),
                      const SizedBox(width: 12),
                      Text(
                        loading ? "INFERENCE ACTIVE" : "IDLE",
                        style: GoogleFonts.jetBrainsMono(
                          color: loading ? const Color(0xFF00E676) : Colors.white54,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // CENTRAL WORKSPACE
          Expanded(
            child: Center(
              child: Container(
                constraints: const BoxConstraints(maxWidth: 1200),
                child: Column(
                  children: [
                    // TOP BAR / METRICS
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            selectedMode,
                            style: GoogleFonts.inter(
                              fontSize: 24,
                              fontWeight: FontWeight.w600,
                              letterSpacing: -0.5,
                            ),
                          ),
                          if (!loading && lastLatencyMs > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1A1A1A),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFF333333)),
                              ),
                              child: Text(
                                "\$ L:$lastLatencyMs ms | C:$lastCharCount | T:${tokenBudget[selectedMode]}",
                                style: GoogleFonts.jetBrainsMono(
                                  fontSize: 12,
                                  color: Colors.white70,
                                ),
                              ).animate().fadeIn(duration: 400.ms),
                            ),
                        ],
                      ),
                    ),

                    // CHAT HISTORY
                    Expanded(
                      child: ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                        itemCount: messages.length,
                        itemBuilder: (_, i) {
                          final msg = messages[i];
                          final isUser = msg.role == "user";
                          
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 24),
                            child: Align(
                              alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                              child: Container(
                                constraints: const BoxConstraints(maxWidth: 750),
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  color: isUser ? Colors.transparent : const Color(0xFF262626),
                                  border: isUser ? Border.all(color: const Color(0xFF333333)) : null,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: isUser
                                    ? Text(
                                        msg.content,
                                        style: GoogleFonts.inter(
                                          color: Colors.white,
                                          fontSize: 16,
                                          height: 1.5,
                                        ),
                                      )
                                    : MarkdownBody(
                                        data: msg.content.isEmpty ? "..." : msg.content,
                                        selectable: true,
                                        styleSheet: MarkdownStyleSheet(
                                          p: GoogleFonts.inter(color: const Color(0xFFE5E2E1), fontSize: 16, height: 1.6),
                                          code: GoogleFonts.jetBrainsMono(color: const Color(0xFF75FF9E), backgroundColor: Colors.transparent),
                                          codeblockDecoration: BoxDecoration(
                                            color: const Color(0xFF131313),
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: const Color(0xFF333333))
                                          ),
                                          a: GoogleFonts.inter(color: const Color(0xFF00E676)),
                                        ),
                                      ),
                              ),
                            ).animate().slideY(begin: 0.1, end: 0, duration: 400.ms, curve: Curves.easeOutCubic).fadeIn(duration: 300.ms),
                          );
                        },
                      ),
                    ),

                    // FLOATING INPUT DOCK
                    Container(
                      margin: const EdgeInsets.fromLTRB(32, 0, 32, 32),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A1A1A),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF333333)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.4),
                            blurRadius: 32,
                            offset: const Offset(0, 12),
                          )
                        ]
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _controller,
                              minLines: 1,
                              maxLines: 6,
                              style: GoogleFonts.inter(color: Colors.white, fontSize: 16),
                              decoration: InputDecoration(
                                hintText: "Enter prompt...",
                                hintStyle: GoogleFonts.inter(color: Colors.white38),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.all(20),
                              ),
                              onSubmitted: (_) => sendPrompt(),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(12.0),
                            child: InkWell(
                              onTap: loading ? null : sendPrompt,
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: loading ? const Color(0xFF333333) : const Color(0xFF00E676),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(
                                  Icons.arrow_upward_rounded,
                                  color: loading ? Colors.white38 : const Color(0xFF003918),
                                ),
                              ),
                            ),
                          )
                        ],
                      ),
                    ).animate().slideY(begin: 1.0, end: 0.0, duration: 600.ms, curve: Curves.easeOutCirc),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
