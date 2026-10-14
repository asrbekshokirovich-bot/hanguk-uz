/// The client code a scanned QR holds, or null.
///
/// The QR may hold the code itself ("HG7K2M9P", any case, spaces or dashes
/// allowed) or a link carrying it: as `code` or `magic_code` in the query,
/// or as the link's last path segment.
String? clientCodeFromQr(String? raw, {int length = 8}) {
  final text = raw?.trim() ?? '';
  if (text.isEmpty) return null;
  String? clean(String? s) {
    if (s == null) return null;
    final c = s.replaceAll(RegExp(r'[\s-]'), '').toUpperCase();
    return RegExp('^[A-Z0-9]{$length}\$').hasMatch(c) ? c : null;
  }

  final direct = clean(text);
  if (direct != null) return direct;
  final uri = Uri.tryParse(text);
  if (uri == null || !uri.hasScheme) return null;
  for (final key in ['code', 'magic_code']) {
    final v = clean(uri.queryParameters[key]);
    if (v != null) return v;
  }
  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  return segments.isEmpty ? null : clean(segments.last);
}
