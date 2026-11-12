/// The words a per-answer review is about.
///
/// `interview-feedback` stores them with each review (`answer`): an answer is
/// several transcript rows joined, and the rows this screen holds in memory
/// carry local ids, not the database ids the review names — so looking the id
/// up never found anything and the review was shown without its answer. The
/// lookup is kept for reviews saved before the function stored the words.
String? reviewedAnswer(Map<dynamic, dynamic> entry, Map<String, String> byId) {
  final stored = entry['answer'];
  if (stored is String && stored.trim().isNotEmpty) return stored.trim();
  final text = byId[entry['message_id']?.toString()];
  if (text == null || text.trim().isEmpty) return null;
  return text.trim();
}
