/// Where "Hanguk Consulting" actually lives.
///
/// The guest header pill opens a sheet built straight from this list, so the
/// channels are edited in one place instead of being spelled out at every call
/// site. Order here is the order on screen.
///
/// TODO(hanguk): replace the placeholders below with the real handles and
/// number before shipping — everything else is wired.
class ContactLinks {
  const ContactLinks._();

  /// Public Telegram channel (announcements).
  static const String telegramChannel = 'https://t.me/hanguk_consulting';

  /// Direct message to the consultant on Telegram.
  static const String telegramDirect = 'https://t.me/hanguk_consulting';

  /// Instagram page.
  static const String instagram =
      'https://instagram.com/hanguk_consulting';

  /// Phone number in E.164, used for the `tel:` link.
  static const String phone = '+998900000000';

  /// Human-readable form of [phone], shown under the "Call" row.
  static const String phoneDisplay = '+998 90 000 00 00';

  static Uri get telegramChannelUri => Uri.parse(telegramChannel);
  static Uri get telegramDirectUri => Uri.parse(telegramDirect);
  static Uri get instagramUri => Uri.parse(instagram);
  static Uri get phoneUri => Uri(scheme: 'tel', path: phone);
}
