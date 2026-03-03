import 'dart:convert';
import 'dart:io';

class MemoryService {
  static const String memoryPath =
      r"C:\Users\mhyas\VolumeD\Kill_the_cloud\memory.json";

  static bool memoryEnabled = true;

  /// Load memory safely
  static List<Map<String, String>> loadMemory() {
    if (!memoryEnabled) return [];

    final file = File(memoryPath);
    if (!file.existsSync()) return [];

    final content = file.readAsStringSync();
    if (content.trim().isEmpty) return [];

    final List<dynamic> data = jsonDecode(content);

    return data.map<Map<String, String>>((item) {
      return {
        "role": item["role"]?.toString() ?? "",
        "content": item["content"]?.toString() ?? "",
      };
    }).toList();
  }

  /// Save memory safely
  static void saveMemory(List<Map<String, String>> memory) {
    if (!memoryEnabled) return;

    final file = File(memoryPath);
    file.writeAsStringSync(
      jsonEncode(memory),
      flush: true,
    );
  }

  /// Append message
  static void addMessage(String role, String content) {
    if (!memoryEnabled) return;

    final memory = loadMemory();
    memory.add({
      "role": role,
      "content": content,
    });
    saveMemory(memory);
  }

  /// Get last N messages
  static List<Map<String, String>> getRecentMemory(int n) {
    final memory = loadMemory();
    if (memory.length <= n) return memory;
    return memory.sublist(memory.length - n);
  }

  /// Clear memory
  static void clearMemory() {
    final file = File(memoryPath);
    file.writeAsStringSync("[]", flush: true);
  }

  /// Toggle memory
  static void setEnabled(bool enabled) {
    memoryEnabled = enabled;
  }
}
