import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/auth_repository.dart';

// ─── Login Screen ──────────────────────────────────────────────────────────────

/// Magic Code (DESIGN_SPEC §3.2).
///
/// Key mark in a lime glass tile, the title with its 매직 코드 accent, the mono
/// code field that lights lime once a full 8-character code is present, and the
/// lime primary action.
///
/// Presentation only — the auth calls, validation thresholds, error handling
/// and providers below are unchanged.
class LoginScreen extends ConsumerStatefulWidget {
  final bool initialMagicCodeMode;

  // A2/S2: Magic Code is the finished primary path. Phone auth is hidden
  // until it ships, so we default to the Magic Code portal.
  const LoginScreen({super.key, this.initialMagicCodeMode = true});

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
    final code = _codeCtrl.text.trim().toUpperCase();

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

    if (result.error != null) {
      // Server-side error string passes through unchanged; the
      // auth_repository normalizes it for display.
      _setError(result.error);
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

    if (result.error != null) {
      // Server-side error string passes through unchanged.
      _setError(result.error);
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
  /// tappable at every length.
  bool _isCodeReady(String text) =>
      text.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').length >= 8;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    // AutofillGroup lets iOS surface the OTP autofill chip and Android group
    // the credential for save-prompt purposes (audit P0 #3).
    //
    // The action lives at the bottom (spec §3.2): the mark, title, field and
    // any message scroll in the space above it, so the "Login to System"
    // button sits under the thumb and rises above the keyboard when the field
    // is focused.
    return SeoulNightScaffold(
      body: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(26, 24, 26, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 24),

                    // ── Mark ───────────────────────────────────────────────
                    const Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: _KeyTile(),
                    ),
                    const SizedBox(height: 18),

                    // Title + decorative hangul accent (Korean in every
                    // locale).
                    HangulTag(
                      en: l10n.magicCodeTitle,
                      ko: '매직 코드',
                      titleStyle: SeoulType.headline,
                    ),
                    const SizedBox(height: 10),

                    Text(
                      l10n.loginAccessCodeHelp,
                      style: SeoulType.bodySecondary,
                    ),
                    const SizedBox(height: 28),

                    // ── Messages ───────────────────────────────────────────
                    if (_error != null) ...[
                      _MessageCard(
                        message: _error!,
                        tint: SeoulColors.dangerText,
                        fill: SeoulColors.dangerFill,
                      ),
                      const SizedBox(height: 16),
                    ],
                    // Sign-in is retrying underneath. Saying so is the whole
                    // point: half a minute of a spinner reads as a hung app.
                    if (_retryNotice != null) ...[
                      _MessageCard(
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
                      _MessageCard(
                        message: _success!,
                        tint: SeoulColors.successText,
                        fill: SeoulColors.successFill,
                      ),
                      const SizedBox(height: 16),
                    ],

                    // ── Field ──────────────────────────────────────────────
                    // Repaints the border/glow as the code is typed — no
                    // extra state, the controller stays the single source of
                    // truth.
                    ValueListenableBuilder<TextEditingValue>(
                      valueListenable: _codeCtrl,
                      builder: (context, value, _) => _MagicCodeField(
                        controller: _codeCtrl,
                        ready: _isCodeReady(value.text),
                        onSubmitted: (_) => _handleStudentLogin(),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // ── Action ─────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(26, 8, 26, 28),
              child: LimeButton(
                label: l10n.loginSubmitButton,
                loading: _loading,
                onPressed: _handleStudentLogin,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Reusable Widgets ─────────────────────────────────────────────────────────

/// The Magic Code mark: a key in a lime glass tile (spec §3.2).
class _KeyTile extends StatelessWidget {
  const _KeyTile();

  static const double _size = 58;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: _size,
      height: _size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: SeoulColors.limeFill,
        borderRadius: SeoulRadii.tileR,
        border: Border.all(
          color: SeoulColors.lime.withValues(alpha: 0.35),
          width: 1,
        ),
        boxShadow: SeoulShadows.limeGlowSmall,
      ),
      child: const Icon(Icons.key, size: 24, color: SeoulColors.lime),
    );
  }
}

/// The access-code input: glass fill, JetBrains Mono at 0.3em tracking, and a
/// lime border + glow the moment a full code is in (spec §3.2).
class _MagicCodeField extends StatelessWidget {
  const _MagicCodeField({
    required this.controller,
    required this.ready,
    required this.onSubmitted,
  });

  final TextEditingController controller;

  /// 8 valid characters entered — border goes lime and the glow comes up.
  final bool ready;

  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: SeoulMotion.base,
      curve: SeoulMotion.smooth,
      decoration: BoxDecoration(
        color: SeoulColors.glass,
        borderRadius: SeoulRadii.controlR,
        border: Border.all(
          color: ready ? SeoulColors.lime : SeoulColors.glassBorder,
          width: 1,
        ),
        boxShadow: ready ? SeoulShadows.limeGlowSmall : null,
      ),
      child: TextField(
        controller: controller,
        textCapitalization: TextCapitalization.characters,
        // OTP autofill: surfaces SMS-code suggestions on iOS QuickType
        // and triggers the Android one-time-code retriever.
        autofillHints: const [AutofillHints.oneTimeCode],
        keyboardType: TextInputType.visiblePassword,
        textInputAction: TextInputAction.done,
        onSubmitted: onSubmitted,
        inputFormatters: [
          FilteringTextInputFormatter.allow(RegExp(r'[A-Z0-9a-z]')),
          LengthLimitingTextInputFormatter(10),
        ],
        style: SeoulType.codeInput,
        cursorColor: SeoulColors.lime,
        decoration: InputDecoration(
          // Mask: code shape is enforced by the inputFormatters; not
          // localized. The hyphen is decorative — matching the prototype's
          // XXXX-XXXX shape — and is stripped from what's typed by the
          // formatters above.
          hintText: 'XXXX-XXXX',
          hintStyle: SeoulType.codeInput.copyWith(color: SeoulColors.textFaint),
          filled: false,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 20,
            vertical: 18,
          ),
        ),
      ),
    );
  }
}

/// Inline error / success banner.
///
/// The tint is a *text* colour on the Seoul Night navy, so it has to be the
/// light end of the semantic pair: `AppColors.error` (#DC2626) measures about
/// 2.1:1 here, well under AA, which would leave the one message explaining a
/// failed sign-in barely readable.
class _MessageCard extends StatelessWidget {
  const _MessageCard({
    required this.message,
    required this.tint,
    required this.fill,
  });

  final String message;

  /// Text and border colour.
  final Color tint;

  /// Background wash.
  final Color fill;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      radius: SeoulRadii.control,
      padding: const EdgeInsets.all(12),
      fillColor: fill,
      borderColor: tint.withValues(alpha: 0.3),
      showShadow: false,
      blur: false,
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: SeoulType.bodySecondary.copyWith(color: tint),
      ),
    );
  }
}
