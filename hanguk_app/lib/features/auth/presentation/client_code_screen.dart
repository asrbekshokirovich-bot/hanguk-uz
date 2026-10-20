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
import 'qr_scan_screen.dart';

/// "Mijoz kodi bilan kirish" (design screen 14): the 8-character code the
/// consultant gave, typed into eight cells. The sign-in itself is the same
/// as before — [AuthRepository.signInWithMagicCode], its retries and its
/// error codes — only the screen is new.
class ClientCodeScreen extends ConsumerStatefulWidget {
  const ClientCodeScreen({super.key, this.notice});

  /// Shown above the cells when another screen sent the visitor here.
  final String? notice;

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

  Future<void> _submit() async {
    final l = AppLocalizations.of(context)!;
    if (_loading) return;
    if (_code.length < 6) {
      setState(() => _error = l.loginErrorInvalidAccessCode);
      return;
    }
    setState(() {
      _error = null;
      _offerGuest = false;
      _retryNotice = null;
      _loading = true;
    });
    final result = await ref
        .read(authRepositoryProvider)
        .signInWithMagicCode(
          _code,
          onRetry: (attempt, total) {
            if (!mounted) return;
            setState(() => _retryNotice = '${AppLocalizations.of(context)!.connecting} ($attempt/$total)');
          },
        );
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

  /// "QR kodni skanerlash": the code from the consultant's QR, signed in
  /// with as if typed.
  Future<void> _scan() async {
    if (_loading) return;
    final code = await QrScanScreen.open(context);
    AppEvents.track('qr_scan', props: {'result': code == null ? 'closed' : 'code'});
    if (code == null || !mounted) return;
    _ctrl.text = code;
    setState(() => _error = null);
    await _submit();
  }

  Future<void> _call() async {
    AppEvents.track('contact_tap', screen: 'client_code', props: {'channel': 'phone'});
    await launchUrl(ContactLinks.phoneUri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final message = _error ?? _retryNotice ?? widget.notice;
    final eight = l.fdCodeEight;
    final sms = l.fdCodeSms(eight);
    final at = sms.indexOf(eight);

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
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(18, 2, 18, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Semantics(
                        button: true,
                        label: MaterialLocalizations.of(context).backButtonTooltip,
                        excludeSemantics: true,
                        child: GestureDetector(
                          onTap: _back,
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            width: 44,
                            height: 44,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: FdColors.card,
                              borderRadius: BorderRadius.circular(13),
                              border: Border.all(color: FdColors.ink, width: 1.5),
                            ),
                            child: const Icon(Icons.arrow_back, size: 22, color: FdColors.ink),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          l.fdCodeTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: fdText(26, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.6),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // "Konsultant SMS da yuborgan **8 belgili** kod".
                  Text.rich(
                    TextSpan(
                      style: fdText(14, FontWeight.w400, FdColors.pageMuted, height: 1.4),
                      children: at < 0
                          ? [TextSpan(text: sms)]
                          : [
                              TextSpan(text: sms.substring(0, at)),
                              TextSpan(text: eight, style: fdText(14, FontWeight.w800, FdColors.onPage, height: 1.4)),
                              TextSpan(text: sms.substring(at + eight.length)),
                            ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  _Cells(
                    controller: _ctrl,
                    focus: _focus,
                    enabled: !_loading,
                    onChanged: () => setState(() => _error = null),
                    onSubmitted: _submit,
                    semanticLabel: l.magicCodeTitle,
                    cellLabel: l.fdCodeCell,
                  ),
                  const SizedBox(height: 14),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _ctrl,
                    builder: (context, value, _) => _Progress(filled: value.text.length),
                  ),
                  if (message != null) ...[
                    const SizedBox(height: 14),
                    Semantics(
                      liveRegion: true,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: _error != null ? const Color(0xFFFDECEC) : FdColors.tint,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: FdColors.ink, width: 1.5),
                        ),
                        child: Text(
                          message,
                          style: fdText(
                            12,
                            FontWeight.w700,
                            _error != null ? FdColors.bad : FdColors.ink,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  HardButton(
                    label: l.fdCodeSubmit,
                    onPressed: _submit,
                    loading: _loading,
                    trailing: const Icon(Icons.arrow_forward, size: 18, color: FdColors.onLime),
                  ),
                  if (_offerGuest) ...[
                    const SizedBox(height: 12),
                    HardChoice(
                      label: l.welcomeExploreCta,
                      selected: false,
                      height: 44,
                      onTap: () => context.go(kDiscoverPath),
                    ),
                  ],
                  const SizedBox(height: 24),
                  Text(
                    l.fdCodeUnlocks.toUpperCase(),
                    style: fdText(11, FontWeight.w800, FdColors.pageMuted, letterSpacing: 0.8),
                  ),
                  const SizedBox(height: 10),
                  IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: _Unlock(
                            icon: const Lucide(LucideIcons.clipboardList, size: 18, color: FdColors.onLime),
                            label: l.fdJourneyTitle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _Unlock(
                            icon: const Lucide(LucideIcons.fileText, size: 18, color: FdColors.onLime),
                            label: l.fdDocsTitle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _Unlock(
                            icon: const Icon(Icons.chat_bubble_outline, size: 18, color: FdColors.onLime),
                            label: l.fdCodeChat,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _WhiteButton(
                          icon: const Lucide(LucideIcons.qrCode, size: 16, color: FdColors.ink),
                          label: l.fdCodeScanShort,
                          onTap: _loading ? null : _scan,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _WhiteButton(
                          icon: const Lucide(LucideIcons.phone, size: 16, color: FdColors.ink),
                          label: l.fdCodeNone,
                          onTap: _call,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Center(
                    child: Semantics(
                      button: true,
                      child: GestureDetector(
                        onTap: _call,
                        behavior: HitTestBehavior.opaque,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                          child: Text.rich(
                            TextSpan(
                              style: fdText(12, FontWeight.w500, FdColors.pageMuted),
                              children: [
                                TextSpan(text: '${l.fdCodeFreeConsult} · '),
                                TextSpan(
                                  text: ContactLinks.phoneDisplay,
                                  style: fdText(12, FontWeight.w800, FdColors.lime),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Eight short bars under the cells: lime for each character typed.
class _Progress extends StatelessWidget {
  const _Progress({required this.filled});

  final int filled;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (var i = 0; i < ClientCodeScreen.length; i++) ...[
        if (i > 0) const SizedBox(width: 6),
        Expanded(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            height: 4,
            decoration: BoxDecoration(
              color: i < filled ? FdColors.lime : Colors.white.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ),
      ],
    ],
  );
}

/// One of "Kod bilan ochiladi": a lime icon tile over its name, on the
/// page's translucent card.
class _Unlock extends StatelessWidget {
  const _Unlock({required this.icon, required this.label});

  final Widget icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(6, 14, 6, 12),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.06),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withValues(alpha: 0.16), width: 1.2),
    ),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
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
          child: icon,
        ),
        const SizedBox(height: 8),
        Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: fdText(12, FontWeight.w800, FdColors.onPage, height: 1.2),
        ),
      ],
    ),
  );
}

/// The white "QR skanerlash" / "Kod yo'q" buttons.
class _WhiteButton extends StatelessWidget {
  const _WhiteButton({required this.icon, required this.label, required this.onTap});

  final Widget icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    enabled: onTap != null,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 46,
        decoration: BoxDecoration(
          color: FdColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: FdColors.ink, width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            icon,
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: fdText(13, FontWeight.w800, FdColors.ink),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Keeps letters and digits only, capitals, at most [ClientCodeScreen.length].
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
    required this.onChanged,
    required this.onSubmitted,
    required this.semanticLabel,
    required this.cellLabel,
  });

  final TextEditingController controller;
  final FocusNode focus;
  final bool enabled;
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
                keyboardType: TextInputType.visiblePassword,
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
