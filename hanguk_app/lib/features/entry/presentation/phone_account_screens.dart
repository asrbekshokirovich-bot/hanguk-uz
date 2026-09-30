import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/auth_controls.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';
import '../data/app_account_repository.dart';
import '../data/entry_store.dart';
import 'widgets/entry_fields.dart';

/// Sign-up (after the language screen) and sign-in with an Uzbek phone number
/// and a password. Both end the same way: the number is remembered
/// ([EntryNotifier.setRegistered]) and the router moves on to Welcome.
///
/// A number that belongs to a Hanguk student is sent to the Magic Code screen
/// instead, with a note saying why.

/// Which fields failed the last check, so their borders can say so.
enum _Invalid { phone, password, confirm }

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with _PhoneAccountForm<RegisterScreen> {
  final _confirmCtrl = TextEditingController();

  @override
  void dispose() {
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context)!;
    if (!validate(l10n)) return;
    if (passwordCtrl.text != _confirmCtrl.text) {
      fail(l10n.entryErrorPasswordMismatch, const {_Invalid.confirm});
      return;
    }
    await run(
      l10n,
      () => ref
          .read(appAccountRepositoryProvider)
          .register(national, passwordCtrl.text),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return formScaffold(
      title: l10n.entryRegisterTitle,
      hangul: '회원가입',
      subtitle: l10n.entryRegisterSubtitle,
      fields: [
        phoneField(l10n),
        const SizedBox(height: 16),
        passwordField(l10n, newPassword: true),
        const SizedBox(height: 16),
        EntryField(
          label: l10n.entryPasswordConfirmLabel,
          controller: _confirmCtrl,
          hint: l10n.entryPasswordHint,
          obscure: true,
          keyboardType: TextInputType.visiblePassword,
          autofillHints: const [AutofillHints.newPassword],
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _submit(),
          invalid: invalid.contains(_Invalid.confirm),
          revealLabel: l10n.entryShowPassword,
          hideLabel: l10n.entryHidePassword,
        ),
      ],
      submitLabel: l10n.entryRegisterSubmit,
      onSubmit: _submit,
      links: [
        EntryLink(
          lead: l10n.entryHaveAccount,
          label: l10n.entrySignInLink,
          onTap: () => context.push('/sign-in'),
        ),
      ],
    );
  }
}

class PhoneSignInScreen extends ConsumerStatefulWidget {
  const PhoneSignInScreen({super.key});

  @override
  ConsumerState<PhoneSignInScreen> createState() => _PhoneSignInScreenState();
}

class _PhoneSignInScreenState extends ConsumerState<PhoneSignInScreen>
    with _PhoneAccountForm<PhoneSignInScreen> {
  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context)!;
    if (!validate(l10n)) return;
    await run(
      l10n,
      () => ref
          .read(appAccountRepositoryProvider)
          .signIn(national, passwordCtrl.text),
    );
  }

  /// Back to sign-up, which is where sign-in is opened from.
  void _toRegister() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/register');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return formScaffold(
      onBack: _toRegister,
      title: l10n.entrySignInTitle,
      hangul: '로그인',
      subtitle: l10n.entrySignInSubtitle,
      fields: [
        phoneField(l10n),
        const SizedBox(height: 16),
        passwordField(
          l10n,
          newPassword: false,
          action: TextInputAction.done,
          onSubmitted: _submit,
        ),
      ],
      submitLabel: l10n.entrySignInSubmit,
      onSubmit: _submit,
      links: [
        EntryLink(
          lead: l10n.entryNoAccount,
          label: l10n.entryRegisterLink,
          onTap: _toRegister,
        ),
      ],
    );
  }
}

/// The state and layout both screens share.
mixin _PhoneAccountForm<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  final phoneCtrl = TextEditingController();
  final passwordCtrl = TextEditingController();

  bool loading = false;
  String? error;
  Set<_Invalid> invalid = const {};

  /// The nine digits after +998.
  String get national => UzPhoneFormatter.digitsOf(phoneCtrl.text);

  @override
  void dispose() {
    phoneCtrl.dispose();
    passwordCtrl.dispose();
    super.dispose();
  }

  void fail(String message, Set<_Invalid> fields) => setState(() {
    error = message;
    invalid = fields;
  });

  /// Phone and password, checked here before anything is sent.
  bool validate(AppLocalizations l10n) {
    if (national.length != kUzNationalDigits) {
      fail(l10n.entryErrorPhone, const {_Invalid.phone});
      return false;
    }
    if (passwordCtrl.text.length < 6) {
      fail(l10n.entryErrorPasswordShort, const {_Invalid.password});
      return false;
    }
    return true;
  }

  Future<void> run(
    AppLocalizations l10n,
    Future<AppAccountResult> Function() call,
  ) async {
    FocusScope.of(context).unfocus();
    setState(() {
      loading = true;
      error = null;
      invalid = const {};
    });
    final result = await call();
    if (!mounted) return;
    setState(() => loading = false);

    switch (result.status) {
      case AppAccountStatus.ok:
        // The router takes it from here: registered → Welcome.
        await ref
            .read(entryProvider.notifier)
            .setRegistered(result.phone ?? uzE164(national));
      case AppAccountStatus.student:
        context.push(
          '/login',
          extra: {'magic_code': true, 'notice': l10n.entryStudentNotice},
        );
      case AppAccountStatus.exists:
        fail(l10n.entryErrorExists, const {_Invalid.phone});
      case AppAccountStatus.invalidPhone:
        fail(l10n.entryErrorPhone, const {_Invalid.phone});
      case AppAccountStatus.weakPassword:
        fail(l10n.entryErrorPasswordShort, const {_Invalid.password});
      case AppAccountStatus.notFound:
        fail(l10n.entryErrorNotFound, const {_Invalid.phone});
      case AppAccountStatus.wrongPassword:
        fail(l10n.entryErrorWrongPassword, const {_Invalid.password});
      case AppAccountStatus.locked:
        fail(l10n.entryErrorLocked, const {});
      case AppAccountStatus.network:
        fail(l10n.entryErrorNetwork, const {});
    }
  }

  Widget phoneField(AppLocalizations l10n) => EntryField(
    label: l10n.entryPhoneLabel,
    controller: phoneCtrl,
    prefix: '+998',
    hint: '90 123 45 67',
    keyboardType: TextInputType.phone,
    inputFormatters: const [UzPhoneFormatter()],
    autofillHints: const [AutofillHints.telephoneNumberNational],
    invalid: invalid.contains(_Invalid.phone),
  );

  Widget passwordField(
    AppLocalizations l10n, {
    required bool newPassword,
    TextInputAction action = TextInputAction.next,
    VoidCallback? onSubmitted,
  }) => EntryField(
    label: l10n.entryPasswordLabel,
    controller: passwordCtrl,
    hint: l10n.entryPasswordHint,
    obscure: true,
    keyboardType: TextInputType.visiblePassword,
    autofillHints: [
      newPassword ? AutofillHints.newPassword : AutofillHints.password,
    ],
    textInputAction: action,
    onSubmitted: onSubmitted == null ? null : (_) => onSubmitted(),
    invalid: invalid.contains(_Invalid.password),
    revealLabel: l10n.entryShowPassword,
    hideLabel: l10n.entryHidePassword,
  );

  /// Header (logo tile, title, hangul accent, one line of help), any error,
  /// the fields, the lime action, the links, and the Magic Code way in.
  Widget formScaffold({
    VoidCallback? onBack,
    required String title,
    required String hangul,
    required String subtitle,
    required List<Widget> fields,
    required String submitLabel,
    required VoidCallback onSubmit,
    required List<Widget> links,
  }) {
    final l10n = AppLocalizations.of(context)!;
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
                  if (onBack != null) ...[
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: AuthBackButton(onPressed: onBack),
                    ),
                    const SizedBox(height: 28 - AuthBackButton.tapSlack),
                  ] else
                    const SizedBox(height: 40),
                  Row(
                    children: [
                      const SignInLogoTile(
                        size: 50,
                        radius: 15,
                        haloBleed: 0,
                        shadowOffsetY: 7,
                        shadowBlur: 14,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title, style: _titleStyle),
                            const SizedBox(height: 3),
                            // Decorative hangul accent (Korean in every
                            // locale), as on the Magic Code screen.
                            Text(hangul, style: _hangulStyle),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Text(subtitle, style: _helpStyle),
                  const SizedBox(height: 28),
                  if (error != null) ...[
                    AuthMessageCard(
                      message: error!,
                      tint: SeoulColors.dangerText,
                      fill: SeoulColors.dangerFill,
                    ),
                    const SizedBox(height: 16),
                  ],
                  ...fields,
                  const SizedBox(height: 24),
                  AuthSubmitButton(
                    label: submitLabel,
                    loading: loading,
                    onPressed: onSubmit,
                  ),
                  const SizedBox(height: 8),
                  ...links,
                  EntryLink(
                    label: l10n.welcomeMagicCodeCta,
                    onTap: () =>
                        context.push('/login', extra: {'magic_code': true}),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  static const TextStyle _titleStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: 26,
    height: 1.21,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.65,
    color: Colors.white,
  );

  static const TextStyle _hangulStyle = TextStyle(
    fontFamily: SeoulType.korean,
    fontFamilyFallback: <String>[SeoulType.inter],
    fontSize: 13,
    height: 1.41,
    fontWeight: FontWeight.w400,
    color: Color.fromRGBO(255, 255, 255, .64),
  );

  static const TextStyle _helpStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: 15,
    height: 1.55,
    leadingDistribution: TextLeadingDistribution.even,
    fontWeight: FontWeight.w400,
    color: Color.fromRGBO(255, 255, 255, .72),
  );
}
