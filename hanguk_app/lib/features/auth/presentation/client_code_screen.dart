import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/analytics/app_events.dart';
import '../../../core/config/contact_links.dart';
import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../discover/presentation/discover_routes.dart';
import '../../discover/presentation/widgets/app_nav.dart';
import '../../discover/presentation/widgets/fd_bottom_nav.dart';
import '../data/auth_repository.dart';
import '../data/remembered_code.dart';

/// "Mijoz kodi bilan kirish" (design screen 14): the 8-character code the
/// consultant gave, typed into eight cells. The sign-in itself is the same
/// as before — [AuthRepository.signInWithMagicCode], its retries and its
/// error codes — only the screen is new.
class ClientCodeScreen extends ConsumerStatefulWidget {
  const ClientCodeScreen({super.key, this.notice, this.embedded = false});

  /// Shown above the cells when another screen sent the visitor here.
  final String? notice;

  /// Inside the guest home's Arizam / Hujjatlar tab (owner, 2026-10-22): the
  /// home's own nav stays under it with that tab lit, so this page has no
  /// nav of its own and no back button.
  final bool embedded;

  /// Every code the CRM has issued is this long.
  static const int length = 8;

  @override
  ConsumerState<ClientCodeScreen> createState() => _ClientCodeScreenState();
}

class _ClientCodeScreenState extends ConsumerState<ClientCodeScreen> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();
  bool _loading = false;
  String? _error;

  /// "Still trying (2/6)" while the repository works through its backoff.
  String? _retryNotice;

  /// Set once a sign-in attempt failed on infrastructure rather than on the
  /// code: the way out is the guest home (App Review 2.1(a)).
  bool _offerGuest = false;

  /// The code that worked on this phone before; null the first time.
  String? _remembered;

  @override
  void initState() {
    super.initState();
    RememberedCode.read().then((code) {
      if (mounted && code != null) setState(() => _remembered = code);
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  String get _code => _ctrl.text;

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(kDiscoverPath);
    }
  }

  /// The eighth character signs in: there is no button (owner, 2026-10-21).
  void _changed() {
    setState(() => _error = null);
    if (_code.length == ClientCodeScreen.length) _submit();
  }

  Future<void> _submit() async {
    final l = AppLocalizations.of(context)!;
    if (_loading) return;
    if (_code.length < 6) {
      setState(() => _error = l.loginErrorInvalidAccessCode);
      return;
    }
    final code = _code;
    setState(() {
      _error = null;
      _offerGuest = false;
      _retryNotice = null;
      _loading = true;
    });
    final result = await ref
        .read(authRepositoryProvider)
        .signInWithMagicCode(
          code,
          onRetry: (attempt, total) {
            if (!mounted) return;
            setState(() => _retryNotice = '${AppLocalizations.of(context)!.connecting} ($attempt/$total)');
          },
        );
    if (result.error == null) await RememberedCode.save(code);
    // The await lasts up to 34 seconds; the router may have moved on.
    if (!mounted) return;
    setState(() {
      _loading = false;
      _retryNotice = null;
    });
    AppEvents.track('sign_in', props: {'result': result.error?.name ?? 'ok'});
    if (result.error case final error?) {
      setState(() => _error = authErrorMessage(l, error));
      if (result.transient) setState(() => _offerGuest = true);
    }
  }

  /// A key of the code's own keypad: a character, or ⌫ when null.
  void _key(String? char) {
    if (_loading) return;
    final t = _code;
    if (char == null) {
      if (t.isNotEmpty) _ctrl.text = t.substring(0, t.length - 1);
    } else if (t.length < ClientCodeScreen.length) {
      _ctrl.text = t + char;
    }
    _changed();
  }

  /// "qo'yish →": the remembered code, all at once.
  void _paste() {
    if (_loading || _remembered == null) return;
    _ctrl.text = _remembered!;
    _changed();
  }

  Future<void> _telegram() async {
    AppEvents.track('contact_tap', screen: 'client_code', props: {'channel': 'telegram'});
    await launchUrl(ContactLinks.telegramDirectUri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final message = _error ?? _retryNotice ?? widget.notice;
    final remembered = _remembered;

    final page = SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 2, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              if (!widget.embedded) ...[
                HardIconButton(
                  glyph: LucideIcons.chevronLeft,
                  semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                  onTap: _back,
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Text(
                  l.fdCodeTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: fdText(18, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.36),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _Banner(onTelegram: _telegram),
          const SizedBox(height: 18),
          Text(l.fdCodeSms(l.fdCodeEight), style: fdText(12, FontWeight.w500, FdColors.pageMuted, height: 1.4)),
          const SizedBox(height: 12),
          _Cells(
            controller: _ctrl,
            focus: _focus,
            enabled: !_loading,
            // With the code's own keypad below, the phone's stays
            // down.
            systemKeyboard: remembered == null,
            onChanged: _changed,
            onSubmitted: _submit,
            semanticLabel: l.magicCodeTitle,
            cellLabel: l.fdCodeCell,
          ),
          if (remembered != null) ...[
            const SizedBox(height: 14),
            _SmsCard(code: remembered, onPaste: _paste),
            const SizedBox(height: 12),
            _Keypad(code: remembered, onKey: _key),
          ],
          if (_loading) ...[
            const SizedBox(height: 16),
            const Center(
              child: SizedBox.square(
                dimension: 24,
                child: CircularProgressIndicator(strokeWidth: 2.5, color: FdColors.lime),
              ),
            ),
          ],
          if (message != null) ...[const SizedBox(height: 14), _Note(text: message, error: _error != null)],
          if (_offerGuest) ...[
            const SizedBox(height: 12),
            HardChoice(
              label: l.welcomeExploreCta,
              selected: false,
              height: 44,
              onTap: () => context.go(kDiscoverPath),
            ),
          ],
        ],
      ),
    );

    // In the home's tab: the home's page, nav and round button are around it.
    if (widget.embedded) return SafeArea(bottom: false, child: page);

    // The home's nav, as on every page; it steps aside for the keyboard.
    final typing = MediaQuery.viewInsetsOf(context).bottom > 0;
    return Scaffold(
      backgroundColor: Colors.transparent,
      resizeToAvoidBottomInset: true,
      bottomNavigationBar: typing ? null : AppNav(current: -1, onLocked: _focus.requestFocus),
      floatingActionButton: typing ? null : const AppNavOrb(current: -1),
      floatingActionButtonLocation: kFdNavOrbLocation,
      body: FdPage(
        // The page's glow fills the screen, not just the content's height.
        child: SizedBox.expand(
          child: SafeArea(child: page),
        ),
      ),
    );
  }
}

/// "Bu bo'lim Hanguk ichki talabalari uchun": blue on a lime shadow, the
/// lock, what the code opens, and the way to the admin on Telegram.
class _Banner extends StatelessWidget {
  const _Banner({required this.onTelegram});

  final VoidCallback onTelegram;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      margin: const EdgeInsets.only(right: 5, bottom: 5),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [FdColors.blue, FdColors.blueDeep],
        ),
        boxShadow: const [BoxShadow(color: FdColors.lime, offset: Offset(5, 5))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: FdColors.lime,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: const Icon(Icons.lock_outline, size: 18, color: FdColors.onLime),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(l.fdCodeBannerTitle, style: fdText(15, FontWeight.w800, FdColors.onPage, height: 1.2)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(l.fdCodeBannerBody, style: fdText(12, FontWeight.w500, const Color(0xFFC9D3F5), height: 1.45)),
          const SizedBox(height: 12),
          HardButton(
            label: l.fdCodeTelegram,
            onPressed: onTelegram,
            leading: const Lucide(LucideIcons.send, size: 16, color: FdColors.onLime),
          ),
        ],
      ),
    );
  }
}

/// The consultant's SMS as it would read: "SMS · Hanguk", the code, and
/// "qo'yish →" to put it in.
class _SmsCard extends StatelessWidget {
  const _SmsCard({required this.code, required this.onPaste});

  final String code;
  final VoidCallback onPaste;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onPaste,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.chat_bubble_outline, size: 18, color: FdColors.navy),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.fdCodeSmsFrom, style: fdText(13, FontWeight.w800, FdColors.ink, height: 1.2)),
                    const SizedBox(height: 2),
                    Text.rich(
                      TextSpan(
                        style: fdText(12, FontWeight.w500, FdColors.muted, height: 1.3),
                        children: [
                          TextSpan(text: '${l.fdCodeYours} '),
                          TextSpan(
                            text: code,
                            style: const TextStyle(
                              fontFamily: 'JetBrainsMono',
                              fontWeight: FontWeight.w600,
                              color: FdColors.ink,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(l.fdCodePaste, style: fdText(12, FontWeight.w800, FdColors.blue)),
            ],
          ),
        ),
      ),
    );
  }
}

/// The keypad of the code's own characters, three to a row, and ⌫.
class _Keypad extends StatelessWidget {
  const _Keypad({required this.code, required this.onKey});

  final String code;
  final ValueChanged<String?> onKey;

  @override
  Widget build(BuildContext context) {
    final keys = <String?>[
      ...{for (final c in code.split('')) c},
      null,
    ];
    final rows = <List<String?>>[
      for (var i = 0; i < keys.length; i += 3) keys.sublist(i, (i + 3).clamp(0, keys.length)),
    ];
    return Column(
      children: [
        for (final row in rows) ...[
          if (row != rows.first) const SizedBox(height: 8),
          Row(
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: i < row.length ? _Key(char: row[i], onTap: () => onKey(row[i])) : const SizedBox(height: 44),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

class _Key extends StatelessWidget {
  const _Key({required this.char, required this.onTap});

  final String? char;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: char ?? MaterialLocalizations.of(context).deleteButtonTooltip,
    excludeSemantics: true,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 44,
        margin: const EdgeInsets.only(right: 2, bottom: 2),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: FdColors.card,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: FdColors.ink, width: 1.5),
          boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(2, 2))],
        ),
        child: char == null
            ? const Icon(Icons.backspace_outlined, size: 18, color: FdColors.ink)
            : Text(char!, style: fdText(16, FontWeight.w800, FdColors.ink, height: 1)),
      ),
    ),
  );
}

/// What the page has to say — the reason it was opened, a wrong code, a
/// retry — on the dark note with a lime edge.
class _Note extends StatelessWidget {
  const _Note({required this.text, required this.error});

  final String text;
  final bool error;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: FdColors.blueNight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: error ? FdColors.bad : FdColors.lime, width: 1.5),
      ),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: fdText(13, FontWeight.w800, error ? const Color(0xFFFFB4B4) : FdColors.onPage, height: 1.35),
      ),
    ),
  );
}

class _CodeFormatter extends TextInputFormatter {
  const _CodeFormatter();

  @override
  TextEditingValue formatEditUpdate(TextEditingValue old, TextEditingValue value) {
    final clean = value.text.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();
    final text = clean.length > ClientCodeScreen.length ? clean.substring(0, ClientCodeScreen.length) : clean;
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// The eight cells over a real, see-through text field: typing, pasting and
/// autofill work as in any field, and the cells show what is in it — white
/// with an ink border when filled, the next one with a lime ring and a
/// blinking cursor, the rest dashed.
class _Cells extends StatefulWidget {
  const _Cells({
    required this.controller,
    required this.focus,
    required this.enabled,
    required this.systemKeyboard,
    required this.onChanged,
    required this.onSubmitted,
    required this.semanticLabel,
    required this.cellLabel,
  });

  final TextEditingController controller;
  final FocusNode focus;
  final bool enabled;
  final bool systemKeyboard;
  final VoidCallback onChanged;
  final VoidCallback onSubmitted;
  final String semanticLabel;
  final String Function(int n) cellLabel;

  @override
  State<_Cells> createState() => _CellsState();
}

class _CellsState extends State<_Cells> with SingleTickerProviderStateMixin {
  late final AnimationController _blink = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))
    ..repeat(reverse: true);

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_rebuild);
    widget.focus.addListener(_rebuild);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_rebuild);
    widget.focus.removeListener(_rebuild);
    _blink.dispose();
    super.dispose();
  }

  void _rebuild() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final text = widget.controller.text;
    final focused = widget.focus.hasFocus;
    return Semantics(
      textField: true,
      label: widget.semanticLabel,
      child: SizedBox(
        height: 64,
        child: Stack(
          children: [
            ExcludeSemantics(
              // HK7R – ____: two groups of four, as the code is read out.
              child: Row(
                children: [
                  for (var i = 0; i < ClientCodeScreen.length; i++) ...[
                    if (i == ClientCodeScreen.length ~/ 2)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Text('–', style: fdText(22, FontWeight.w800, FdColors.pageMuted)),
                      )
                    else if (i > 0)
                      const SizedBox(width: 6),
                    Expanded(
                      child: _Cell(
                        char: i < text.length ? text[i] : null,
                        current: focused && i == text.length && text.length < ClientCodeScreen.length,
                        blink: _blink,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // The real field, over the cells and invisible.
            Positioned.fill(
              child: TextField(
                controller: widget.controller,
                focusNode: widget.focus,
                enabled: widget.enabled,
                autofocus: true,
                autocorrect: false,
                enableSuggestions: false,
                textCapitalization: TextCapitalization.characters,
                keyboardType: widget.systemKeyboard ? TextInputType.visiblePassword : TextInputType.none,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: const [_CodeFormatter()],
                maxLength: ClientCodeScreen.length,
                showCursor: false,
                cursorColor: Colors.transparent,
                style: const TextStyle(color: Colors.transparent, fontSize: 1, height: 1),
                // Every border spelled out: the app theme's input borders
                // (a lime focus ring, a glass fill) would otherwise draw
                // around the whole row of cells.
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  disabledBorder: InputBorder.none,
                  errorBorder: InputBorder.none,
                  focusedErrorBorder: InputBorder.none,
                  counterText: '',
                  contentPadding: EdgeInsets.zero,
                  fillColor: Colors.transparent,
                  filled: false,
                ),
                onChanged: (_) => widget.onChanged(),
                onSubmitted: (_) => widget.onSubmitted(),
                textInputAction: TextInputAction.done,
                contextMenuBuilder: (context, state) =>
                    AdaptiveTextSelectionToolbar.editableText(editableTextState: state),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.char, required this.current, required this.blink});

  final String? char;
  final bool current;
  final Animation<double> blink;

  @override
  Widget build(BuildContext context) {
    final filled = char != null;
    if (!filled && !current) {
      // Still to come: a dashed outline on the page.
      // The same inset as a filled cell's shadow takes, so all eight are
      // one size.
      return Padding(
        padding: const EdgeInsets.only(right: 3, bottom: 3),
        child: CustomPaint(
          foregroundPainter: const DashedPillPainter(color: FdColors.navRule, radius: 12),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const SizedBox.expand(),
          ),
        ),
      );
    }
    // Typed: white; the next one: lime with the cursor. Both stand on a hard
    // ink shadow.
    return Padding(
      padding: const EdgeInsets.only(right: 3, bottom: 3),
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: filled ? FdColors.card : FdColors.lime,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: FdColors.ink, width: 1.5),
          boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
        ),
        child: filled
            ? Text(
                char!,
                style: const TextStyle(
                  fontFamily: 'JetBrainsMono',
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: FdColors.ink,
                  height: 1,
                ),
              )
            : FadeTransition(
                opacity: blink,
                child: const SizedBox(width: 2.5, height: 28, child: ColoredBox(color: FdColors.ink)),
              ),
      ),
    );
  }
}

/// The words for an [AuthError], in the app language.
String authErrorMessage(AppLocalizations l, AuthError error) => switch (error) {
  AuthError.invalidAccessCode => l.loginErrorInvalidAccessCode,
  AuthError.codeNotFound => l.authErrorCodeNotFound,
  AuthError.serverUnreachable => l.authErrorServerUnreachable,
  AuthError.staffBlocked => l.authErrorStaffBlocked,
  AuthError.accountSetupBusy => l.authErrorAccountSetupBusy,
  AuthError.loginServerError => l.authErrorLoginServer,
  AuthError.unexpected => l.authErrorUnexpected,
  AuthError.crmAccount => l.authErrorCrmAccount,
  AuthError.alreadyRegistered => l.authErrorAlreadyRegistered,
  AuthError.signUpDisabled => l.authErrorSignUpDisabled,
  AuthError.invalidPhoneFormat => l.authErrorPhoneFormat,
  AuthError.invalidCredentials => l.loginErrorInvalidCredentials,
  AuthError.signUpFailed => l.authErrorSignUpFailed,
};
