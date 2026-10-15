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
    final ready = _code.length >= ClientCodeScreen.length;
    final message = _error ?? _retryNotice ?? widget.notice;

    return Scaffold(
      backgroundColor: Colors.transparent,
      resizeToAvoidBottomInset: true,
      body: FdPage(
        child: SafeArea(
          child: Stack(
            children: [
              LayoutBuilder(
                builder: (context, box) => SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: box.maxHeight),
                    child: IntrinsicHeight(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
                            child: Row(
                              children: [
                                HardIconButton(
                                  glyph: LucideIcons.chevronLeft,
                                  size: 38,
                                  semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                                  onTap: _back,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    l.fdCodeTitle,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: fdText(24, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.5),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
                            child: Text(l.fdCodeSub, style: fdText(15, FontWeight.w400, FdColors.pageMuted, height: 1.45)),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
                            child: _Cells(
                              controller: _ctrl,
                              focus: _focus,
                              enabled: !_loading,
                              onChanged: () => setState(() => _error = null),
                              onSubmitted: _submit,
                              semanticLabel: l.magicCodeTitle,
                              cellLabel: l.fdCodeCell,
                            ),
                          ),
                          if (message != null)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                              child: Semantics(
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
                                    style: fdText(12, FontWeight.w700, _error != null ? FdColors.bad : FdColors.ink, height: 1.35),
                                  ),
                                ),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // White until all eight cells are filled, then lime.
                                HardButton(
                                  label: l.fdCodeSubmit,
                                  onPressed: _submit,
                                  loading: _loading,
                                  fill: ready || _loading ? FdColors.lime : FdColors.card,
                                  foreground: ready || _loading ? FdColors.onLime : FdColors.muted,
                                ),
                                const SizedBox(height: 12),
                                _ScanButton(label: l.fdCodeScan, onTap: _loading ? null : _scan),
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
                          ),
                          const Spacer(),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(22, 16, 22, 16),
                            child: Column(
                              children: [
                                Text(l.fdCodeNoCode, style: fdText(12, FontWeight.w400, FdColors.pageMuted)),
                                const SizedBox(height: 6),
                                Semantics(
                                  button: true,
                                  child: GestureDetector(
                                    onTap: _call,
                                    behavior: HitTestBehavior.opaque,
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                                      child: Text(
                                        ContactLinks.phoneDisplay,
                                        style: fdText(15, FontWeight.w800, FdColors.lime),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

}

/// The white "QR kodni skanerlash" button under "Kirish".
class _ScanButton extends StatelessWidget {
  const _ScanButton({required this.label, required this.onTap});

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
        height: 44,
        decoration: BoxDecoration(
          color: FdColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: FdColors.ink, width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Lucide(LucideIcons.qrCode, size: 16, color: FdColors.ink),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: fdText(13, FontWeight.w700, FdColors.ink),
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
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
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
        height: 52,
        child: Stack(
          children: [
            ExcludeSemantics(
              child: Row(
                children: [
                  for (var i = 0; i < ClientCodeScreen.length; i++) ...[
                    if (i > 0) const SizedBox(width: 6),
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
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  counterText: '',
                  contentPadding: EdgeInsets.zero,
                  fillColor: Colors.transparent,
                  filled: false,
                ),
                onChanged: (_) => widget.onChanged(),
                onSubmitted: (_) => widget.onSubmitted(),
                textInputAction: TextInputAction.done,
                contextMenuBuilder: (context, state) => AdaptiveTextSelectionToolbar.editableText(editableTextState: state),
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
    final box = Container(
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: filled || current ? FdColors.card : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        border: filled || current ? Border.all(color: current ? FdColors.lime : FdColors.ink, width: current ? 2 : 1.5) : null,
      ),
      child: filled
          ? Text(char!, style: const TextStyle(fontFamily: 'JetBrainsMono', fontSize: 22, fontWeight: FontWeight.w600, color: FdColors.ink, height: 1))
          : current
          ? FadeTransition(opacity: blink, child: const SizedBox(width: 2, height: 24, child: ColoredBox(color: FdColors.ink)))
          : null,
    );
    if (filled || current) return box;
    return CustomPaint(foregroundPainter: const DashedPillPainter(color: FdColors.navRule, radius: 10), child: box);
  }
}

/// The words for an [AuthError], in the app language.
String authErrorMessage(AppLocalizations l, AuthError error) =>
    switch (error) {
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
