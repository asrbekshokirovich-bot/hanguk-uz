/// Reads a whole PostgREST result, however long it is.
///
/// The API answers at most 1000 rows per request and says nothing when it cut
/// the list short. The card stack's «Muddat» read every university's admission
/// steps in one request: 3333 rows on 2026-11-12, so 120 of the 177
/// universities were shown without their application deadline.
///
///     final rows = await fetchAllRows((from, to) => client
///         .from('v_app_university_rounds').select()
///         .order('guideline_id').order('bosqich').order('etap_raqam')
///         .range(from, to));
///
/// The query MUST have a total order (end it on columns that are unique
/// together): pages of an unordered query can overlap or skip rows.
Future<List<dynamic>> fetchAllRows(
  Future<List<dynamic>> Function(int from, int to) page, {
  int pageSize = 1000,
  int maxPages = 50,
}) async {
  final rows = <dynamic>[];
  for (var i = 0; i < maxPages; i++) {
    final from = i * pageSize;
    final batch = await page(from, from + pageSize - 1);
    rows.addAll(batch);
    // A short page is the last one. (A full page may be too — then the next
    // request comes back empty: one more round trip, nothing lost.)
    if (batch.length < pageSize) return rows;
  }
  throw StateError('fetchAllRows: more than ${maxPages * pageSize} rows');
}
