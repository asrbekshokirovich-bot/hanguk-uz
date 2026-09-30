import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/auth_repository.dart';
import 'widgets/auth_controls.dart';
import 'widgets/sign_in_chrome.dart';

// ─── Login Screen ──────────────────────────────────────────────────────────────

/// Magic Code (DESIGN_SPEC §3.2).
///
/// Sign-in 2a "Student Magic-Code": a back button, the key mark in a lime glass
/// tile beside the title and its 매직 코드 accent, the mono code field with its
/// XXXX-XXXX mask, the lime primary action, and a "no code" line under it.
///
/// Presentation only — the auth calls, validation thresholds, error handling
/// and providers below are unchanged.
class LoginScreen extends ConsumerStatefulWidget {
  final bool initialMagicCodeMode;

  /// Shown above the field when another screen sent the visitor here — the
  /// phone sign-up, for a number that belongs to a Hanguk student.
  final String? notice;

  // A2/S2: Magic Code is the finished primary path. Phone auth is hidden
  // until it ships, so we default to the Magic Code portal.
  const LoginScreen({super.key, this.initialMagicCodeMode = true, this.notice});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  // Sign In
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  late bool _isMagicCodeMode;

  // Sign Up
  final _signUpNameCtrl = TextEditingController();
  final _signUpPhoneCtrl = TextEditingController();
  final _signUpPasswordCtrl = TextEditingController();
  final _signUpConfirmCtrl = TextEditingController();

  bool _loading = false;
  String? _error;
  String? _success;

  /// "Still trying (2/6)" while the repository works through its backoff.
  ///
  /// Without this the app looks frozen for up to half a minute when the
  /// backend is briefly unreachable — and a reviewer who sees a frozen screen
  /// reports a bug just as readily as one who sees an error.
  String? _retryNotice;

  /// Set once a sign-in attempt has failed on infrastructure rather than on
  /// the code. It offers the way out of the screen — see the guest button in
  /// [build] and the note on 2.1(a) there.
  bool _offerGuest = false;

  @override
  void initState() {
    super.initState();
    _isMagicCodeMode = widget.initialMagicCodeMode;
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) {
        _setError(null);
        _setSuccess(null);
      }
    });
    // Update checks moved to `UpdateGate` (wraps MaterialApp.builder), so
    // they fire on every app launch + foreground transition, not just from
    // this screen.
  }

  @override
  void dispose() {
    _tabController.dispose();
    _phoneCtrl.dispose();
    _passwordCtrl.dispose();
    _codeCtrl.dispose();
    _signUpNameCtrl.dispose();
    _signUpPhoneCtrl.dispose();
    _signUpPasswordCtrl.dispose();
    _signUpConfirmCtrl.dispose();
    super.dispose();
  }

  void _setError(String? msg) => setState(() {
    _error = msg;
    if (msg != null) _success = null;
  });

  void _setSuccess(String? msg) => setState(() {
    _success = msg;
    if (msg != null) _error = null;
  });

  void _setLoading(bool v) => setState(() => _loading = v);

  // ─── Public Student Log In (Phone) ──────────────────────────────────────────

  Future<void> _handlePhoneLogin() async {
    final l10n = AppLocalizations.of(context)!;
    final phone = _phoneCtrl.text.trim();
    final password = _passwordCtrl.text.trim();

    if (phone.isEmpty || phone.length < 5) {
      _setError(l10n.loginErrorInvalidPhone);
      return;
    }
    if (password.length < 6) {
      _setError(l10n.loginErrorPasswordTooShort);
      return;
    }

    _setError(null);
    _setLoading(true);
    final result = await ref
        .read(authRepositoryProvider)
        .signInWithPhone(phone, password);
    _setLoading(false);

    if (result.error != null) {
      _setError(l10n.loginErrorInvalidCredentials);
    }
  }

  // ─── Inner Student Log In ────────────────────────────────────────────────────

  Future<void> _handleStudentLogin() async {
    final l10n = AppLocalizations.of(context)!;
    // The field shows the code as XXXX-XXXX; only the letters and digits are
    // the code.
    final code = _codeCtrl.text
        .replaceAll(RegExp(r'[^A-Za-z0-9]'), '')
        .toUpperCase();

    if (code.length < 6) {
      _setError(l10n.loginErrorInvalidAccessCode);
      return;
    }

    _setError(null);
    setState(() {
      _offerGuest = false;
      _retryNotice = null;
    });
    _setLoading(true);
    final result = await ref
        .read(authRepositoryProvider)
        .signInWithMagicCode(
          code,
          onRetry: (attempt, total) {
            if (!mounted) return;
            final l10n = AppLocalizations.of(context)!;
            setState(() {
              // Reuses an existing key on purpose: `flutter gen-l10n` cannot be
              // run where this was written, so a new .arb entry would compile
              // everywhere except here — and an untested l10n change on the
              // login screen is exactly the risk this patch exists to remove.
              // The counter carries the extra meaning and needs no translation.
              _retryNotice = '${l10n.connecting} ($attempt/$total)';
            });
          },
        );
    // The await above now lasts up to 34 seconds instead of two, which turns a
    // theoretical race into a likely one: background the app, or let the router
    // pop this screen, and every setState below fires on a disposed State and
    // throws. One guard, immediately after the await, covers all of them.
    if (!mounted) return;
    _setLoading(false);
    setState(() => _retryNotice = null);

    if (result.error case final error?) {
      // The repository reports a code; the words are in the app language.
      _setError(_authErrorMessage(l10n, error));
      // A sign-in that failed on infrastructure must not leave the app with
      // nothing to look at. Six App Review rejections, and on 2026-09-01 the
      // reviewer's three requests were answered by the hosting gateway with
      // HTTP 502 before they reached our code — the app was blameless and was
      // rejected anyway, under 2.1(a), because the login screen was as far as
      // anyone got. Guest mode already shows the universities, the map and the
      // comparison; offering it here means a backend blip costs the visitor a
      // sign-in, not the whole app.
      if (result.transient) {
        setState(() => _offerGuest = true);
      }
    }
  }

  // ─── Public Student Sign Up (Phone) ─────────────────────────────────────────

  Future<void> _handleSignUp() async {
    final l10n = AppLocalizations.of(context)!;
    final name = _signUpNameCtrl.text.trim();
    final phone = _signUpPhoneCtrl.text.trim();
    final password = _signUpPasswordCtrl.text.trim();
    final confirm = _signUpConfirmCtrl.text.trim();

    if (name.isEmpty) {
      _setError(l10n.signUpErrorNameRequired);
      return;
    }
    if (phone.isEmpty || phone.length < 5) {
      _setError(l10n.signUpErrorPhoneRequired);
      return;
    }
    if (password.length < 6) {
      _setError(l10n.loginErrorPasswordTooShort);
      return;
    }
    if (password != confirm) {
      _setError(l10n.signUpErrorPasswordMismatch);
      return;
    }

    _setError(null);
    _setLoading(true);
    final result = await ref
        .read(authRepositoryProvider)
        .signUpStudent(phone, password, name);
    _setLoading(false);

    if (result.error case final error?) {
      _setError(_authErrorMessage(l10n, error));
      if (result.isCrmAccount) {
        // Automatically switch to Magic Code Mode
        Future.delayed(const Duration(milliseconds: 1500), () {
          if (mounted) {
            setState(() {
              _isMagicCodeMode = true;
            });
          }
        });
      } else if (result.alreadyRegistered) {
        // Pre-fill phone number in Sign In screen
        _phoneCtrl.text = phone;
        // Automatically switch to Sign In Tab
        Future.delayed(const Duration(milliseconds: 1500), () {
          if (mounted) {
            _tabController.animateTo(0);
          }
        });
      }
    } else {
      _setSuccess(l10n.signUpSuccess);
      _signUpPasswordCtrl.clear();
      _signUpConfirmCtrl.clear();
      _tabController.animateTo(0);
    }
  }

  // ─── Build ────────────────────────────────────────────────────────────────────

  /// Purely presentational: the field lights lime once a full 8-character code
  /// is present (spec §3.2). Submission validation is untouched and still
  /// lives in [_handleStudentLogin], which is why the primary button stays
  /// tappable at every length. The mask hyphen is not a character, so it is
  /// stripped before counting.
  bool _isCodeReady(String text) =>
      text.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').length >= 8;

  /// Back to wherever the visitor came from — Welcome, in practice. A deep
  /// link or a redirect can land here with nothing under it, so fall back to
  /// Welcome instead of popping the app away.
  void _handleBack() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/welcome');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    // AutofillGroup lets iOS surface the OTP autofill chip and Android group
    // the credential for save-prompt purposes (audit P0 #3).
    //
    // One scrolling column (Sign-in 2a "Student Magic-Code"): back button,
    // mark and title, help, any message, then the field, the action and the
    // "no code" line directly under it. The backdrop sits outside the
    // Scaffold so it does not squeeze when the keyboard resizes the body; the
    // column scrolls instead, and the field's scroll padding keeps the button
    // in view above the keyboard.
    return SignInBackdrop(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          child: AutofillGroup(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Back ─────────────────────────────────────────────────
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: AuthBackButton(onPressed: _handleBack),
                  ),
                  // 28 in the design, less the 4px of tap target the back
                  // button carries below its 40px face.
                  const SizedBox(height: 28 - AuthBackButton.tapSlack),

                  // ── Mark + title ─────────────────────────────────────────
                  Row(
                    children: [
                      const _KeyTile(),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(l10n.magicCodeTitle, style: _titleStyle),
                            const SizedBox(height: 3),
                            // Decorative hangul accent (Korean in every
                            // locale).
                            const Text('매직 코드', style: _hangulStyle),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  Text(l10n.loginAccessCodeHelp, style: _helpStyle),
                  const SizedBox(height: 28),

                  // ── Messages ─────────────────────────────────────────────
                  if (widget.notice != null) ...[
                    AuthMessageCard(
                      message: widget.notice!,
                      tint: SeoulColors.infoText,
                      fill: SeoulColors.infoFill,
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (_error != null) ...[
                    AuthMessageCard(
                      message: _error!,
                      tint: SeoulColors.dangerText,
                      fill: SeoulColors.dangerFill,
                    ),
                    const SizedBox(height: 16),
                  ],
                  // Sign-in is retrying underneath. Saying so is the whole
                  // point: half a minute of a spinner reads as a hung app.
                  if (_retryNotice != null) ...[
                    AuthMessageCard(
                      message: _retryNotice!,
                      tint: SeoulColors.infoText,
                      fill: SeoulColors.infoFill,
                    ),
                    const SizedBox(height: 16),
                  ],
                  // The way out when sign-in failed on infrastructure. On
                  // 2026-09-01 the reviewer's three requests were answered
                  // by the hosting gateway with HTTP 502 before they reached
                  // our code, and the app was rejected under 2.1(a) because
                  // the login screen was as far as anyone got. Guest mode
                  // already shows the universities, the map and the
                  // comparison — so a backend blip now costs a sign-in, not
                  // the whole app.
                  if (_offerGuest) ...[
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => context.go('/guest'),
                        child: Text(l10n.welcomeExploreCta),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (_success != null) ...[
                    AuthMessageCard(
                      message: _success!,
                      tint: SeoulColors.successText,
                      fill: SeoulColors.successFill,
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ── Field ────────────────────────────────────────────────
                  // Repaints the border/ring and the faint mask remainder as
                  // the code is typed — no extra state, the controller stays
                  // the single source of truth.
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _codeCtrl,
                    builder: (context, value, _) => _MagicCodeField(
                      controller: _codeCtrl,
                      ready: _isCodeReady(value.text),
                      onSubmitted: (_) => _handleStudentLogin(),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // ── Action ───────────────────────────────────────────────
                  AuthSubmitButton(
                    label: l10n.loginSubmitButton,
                    loading: _loading,
                    onPressed: _handleStudentLogin,
                  ),
                  const SizedBox(height: 12 + 4),

                  // Plain text: the design gives it no action.
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: '${l10n.loginNoCodePrompt} '),
                        TextSpan(
                          text: l10n.loginAskConsultant,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    textAlign: TextAlign.center,
                    style: _noCodeStyle,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // Every line height is set: unset, it would inherit the theme's body
  // height. Where the design leaves `line-height: normal`, the value is what
  // the browser renders — Inter's own ascent + descent, 1.21.
  static const double _normal = 1.21;

  static const TextStyle _titleStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: 26,
    height: _normal,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.65, // -.025em
    color: Colors.white,
  );

  static const TextStyle _hangulStyle = TextStyle(
    fontFamily: SeoulType.korean,
    fontFamilyFallback: <String>[SeoulType.inter],
    fontSize: 13,
    // Sized so title + gap + accent come to the 52px block the design
    // renders.
    height: 1.41,
    fontWeight: FontWeight.w400,
    color: Color.fromRGBO(255, 255, 255, .64),
  );

  static const TextStyle _helpStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: 15,
    height: 1.55,
    // CSS splits the extra line height evenly above and below the glyphs.
    leadingDistribution: TextLeadingDistribution.even,
    fontWeight: FontWeight.w400,
    color: Color.fromRGBO(255, 255, 255, .72),
  );

  static const TextStyle _noCodeStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: 14,
    height: _normal,
    fontWeight: FontWeight.w400,
    color: Color.fromRGBO(255, 255, 255, .72),
  );
}

// ─── Reusable Widgets ─────────────────────────────────────────────────────────

/// The Magic Code mark: a key in a lime glass tile.
class _KeyTile extends StatelessWidget {
  const _KeyTile();

  static const double _size = 50;
  static const double _radius = 15;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: _size,
      height: _size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: cssLinearGradient(
          160,
          const Size.square(_size),
          colors: const [
            Color.fromRGBO(212, 233, 76, .22),
            Color.fromRGBO(212, 233, 76, .06),
          ],
        ),
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(color: const Color.fromRGBO(212, 233, 76, .32)),
      ),
      foregroundDecoration: const InsetEdgesDecoration(
        radius: _radius,
        top: Color.fromRGBO(255, 255, 255, .12),
        inset: 1,
      ),
      child: const SignInIconView(
        SignInIcon.key,
        size: 22,
        color: SeoulColors.lime,
      ),
    );
  }
}

/// Keeps only letters and digits (typed, pasted or autofilled alike), caps
/// them at [maxChars], and inserts the mask hyphen once a fifth character
/// arrives — so the field reads `HK7M-XXXX` as it fills. The hyphen is
/// decoration only; [_LoginScreenState._handleStudentLogin] strips it.
class _MagicCodeFormatter extends TextInputFormatter {
  const _MagicCodeFormatter({required this.maxChars});

  final int maxChars;

  static final RegExp _notCodeChar = RegExp(r'[^A-Za-z0-9]');

  static String format(String raw) =>
      raw.length > 4 ? '${raw.substring(0, 4)}-${raw.substring(4)}' : raw;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var raw = newValue.text.replaceAll(_notCodeChar, '');
    if (raw.length > maxChars) raw = raw.substring(0, maxChars);
    final text = format(raw);
    // Already in shape: leave the value alone, selection and all.
    if (text == newValue.text) return newValue;

    // Keep the caret after the same number of code characters it followed.
    final end = newValue.selection.isValid
        ? newValue.selection.end.clamp(0, newValue.text.length)
        : newValue.text.length;
    var before = newValue.text
        .substring(0, end)
        .replaceAll(_notCodeChar, '')
        .length;
    if (before > raw.length) before = raw.length;
    final offset = format(raw.substring(0, before)).length;

    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: offset),
    );
  }
}

/// The access-code input: glass fill, JetBrains Mono at 0.3em tracking, the
/// untyped rest of the `XXXX-XXXX` mask shown faint after what has been
/// typed, and a lime border + ring while the code is being entered or once a
/// full code is in (spec §3.2).
class _MagicCodeField extends StatefulWidget {
  const _MagicCodeField({
    required this.controller,
    required this.ready,
    required this.onSubmitted,
  });

  final TextEditingController controller;

  /// 8 valid characters entered — border goes lime and the ring comes up.
  final bool ready;

  final ValueChanged<String> onSubmitted;

  @override
  State<_MagicCodeField> createState() => _MagicCodeFieldState();
}

class _MagicCodeFieldState extends State<_MagicCodeField> {
  // Mask: code shape is enforced by the formatter; not localized. The
  // hyphen is decorative — matching the prototype's XXXX-XXXX shape.
  static const String _mask = 'XXXX-XXXX';

  static const double _height = 62;
  static const double _radius = 16;
  static const double _border = 1.5;

  static const Color _lime = SeoulColors.lime;

  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    _focus.removeListener(_onFocusChange);
    _focus.dispose();
    super.dispose();
  }

  void _onFocusChange() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final active = _focus.hasFocus || widget.ready;
    final text = widget.controller.text;
    final rest = text.length < _mask.length ? _mask.substring(text.length) : '';
    const style = SeoulType.codeInput;

    // The mask is centred as a whole, like the design; typed text starts at
    // the mask's left edge so it never shifts while the code fills in.
    final painter = TextPainter(
      text: const TextSpan(text: _mask, style: style),
      textDirection: TextDirection.ltr,
      textScaler: MediaQuery.textScalerOf(context),
    )..layout();
    final maskWidth = painter.width;
    painter.dispose();

    return AnimatedContainer(
      duration: SeoulMotion.base,
      curve: SeoulMotion.smooth,
      // CSS `0 0 0 4px rgba(212,233,76,.10)`: a solid ring outside the
      // field. Drawn as an outside border rather than a shadow, which would
      // also tint the see-through fill.
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(
          color: active
              ? const Color.fromRGBO(212, 233, 76, .10)
              : const Color.fromRGBO(212, 233, 76, 0),
          width: 4,
          strokeAlign: BorderSide.strokeAlignOutside,
        ),
      ),
      child: AnimatedContainer(
        duration: SeoulMotion.base,
        curve: SeoulMotion.smooth,
        height: _height,
        decoration: BoxDecoration(
          color: const Color.fromRGBO(255, 255, 255, .07),
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(
            color: active ? _lime : const Color.fromRGBO(255, 255, 255, .12),
            width: _border,
          ),
        ),
        foregroundDecoration: const InsetEdgesDecoration(
          radius: _radius,
          top: Color.fromRGBO(255, 255, 255, .08),
          inset: _border,
        ),
        child: GestureDetector(
          // The text line is shorter than the field; a tap anywhere on the
          // field focuses it.
          behavior: HitTestBehavior.opaque,
          onTap: _focus.requestFocus,
          child: LayoutBuilder(
            builder: (context, constraints) {
              // Flutter puts half of the letter spacing before each glyph
              // where CSS puts all of it after, so the run starts that much
              // further left to land where the design has it.
              final lead =
                  ((constraints.maxWidth - maskWidth) / 2 -
                          style.letterSpacing! / 2)
                      .clamp(0.0, double.infinity);
              return Stack(
                alignment: AlignmentDirectional.centerStart,
                children: [
                  // What is still to type, laid out after an invisible copy
                  // of what has been typed so it lines up with the field.
                  ExcludeSemantics(
                    child: IgnorePointer(
                      child: Padding(
                        padding: EdgeInsets.only(left: lead),
                        child: Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: text,
                                style: const TextStyle(
                                  color: Color(0x00FFFFFF),
                                ),
                              ),
                              TextSpan(
                                text: rest,
                                style: const TextStyle(
                                  color: Color.fromRGBO(255, 255, 255, .3),
                                ),
                              ),
                            ],
                          ),
                          style: style,
                          maxLines: 1,
                          softWrap: false,
                          overflow: TextOverflow.clip,
                        ),
                      ),
                    ),
                  ),
                  TextField(
                    controller: widget.controller,
                    focusNode: _focus,
                    textCapitalization: TextCapitalization.characters,
                    // OTP autofill: surfaces SMS-code suggestions on iOS
                    // QuickType and triggers the Android one-time-code
                    // retriever.
                    autofillHints: const [AutofillHints.oneTimeCode],
                    keyboardType: TextInputType.visiblePassword,
                    textInputAction: TextInputAction.done,
                    onSubmitted: widget.onSubmitted,
                    inputFormatters: const [_MagicCodeFormatter(maxChars: 10)],
                    style: style,
                    cursorColor: _lime,
                    // Room for the button and the line under it, so focusing
                    // the field scrolls the action above the keyboard too.
                    scrollPadding: const EdgeInsets.fromLTRB(20, 20, 20, 120),
                    decoration: InputDecoration(
                      isCollapsed: true,
                      // Invisible: the painted mask above shows the shape;
                      // this keeps it announced to screen readers.
                      hintText: _mask,
                      hintStyle: style.copyWith(color: const Color(0x00FFFFFF)),
                      filled: false,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: EdgeInsets.only(left: lead),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

/// Words, in the app language, for a sign-in or sign-up failure the
/// repository reported.
String _authErrorMessage(AppLocalizations l, AuthError error) =>
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
