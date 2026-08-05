/// Where "Hanguk Consulting" actually lives.
///
/// The guest header pill opens a sheet built straight from this list, so the
/// channels are edited in one place instead of being spelled out at every call
/// site. Order here is the order on screen.
class ContactLinks {
  const ContactLinks._();

  /// Public Telegram channel (announcements).
  static const String telegramChannel = 'https://t.me/hanguk_consulting';

  /// Direct message to the consultant on Telegram (@hangukuz_consulting).
  static const String telegramDirect = 'https://t.me/hangukuz_consulting';

  /// Instagram page. The `igsh` token the link was copied with is dropped on
  /// purpose: it is a per-share tracking parameter, not part of the address.
  static const String instagram =
      'https://www.instagram.com/hanguk_consulting';

  /// Phone number in E.164, used for the `tel:` link.
  static const String phone = '+998505901530';

  /// Human-readable form of [phone], shown under the "Call" row.
  static const String phoneDisplay = '+998 50 590 15 30';

  static Uri get telegramChannelUri => Uri.parse(telegramChannel);
  static Uri get telegramDirectUri => Uri.parse(telegramDirect);
  static Uri get instagramUri => Uri.parse(instagram);
  static Uri get phoneUri => Uri(scheme: 'tel', path: phone);
}
