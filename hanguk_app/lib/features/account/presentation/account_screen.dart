import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/data/auth_repository.dart';

/// Account management screen — sign out and (irreversibly) delete the
/// account. The deletion flow is required by both Apple App Store
/// (Guideline 5.1.1(v)) and Google Play (User Data policy, 2024+) for
/// any app that supports account creation.
///
/// Seoul Night pass: hero identity card + glass rows with hangul glyph
/// tiles. Deleting an account is irreversible, so it wears
/// `SeoulColors.danger*` — amber would read as "heads up" for something
/// that cannot be undone. The tone is desaturated for the navy surface
/// rather than a raw red.
class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  bool _signingOut = false;
  bool _exporting = false;

  /// P1 #31: invoke the `export-my-data` Edge Function, persist the JSON
  /// to the app docs dir, then surface the platform share sheet so the
  /// user keeps a copy.
  Future<void> _exportMyData() async {
    setState(() => _exporting = true);
    try {
      final client = Supabase.instance.client;
      final res = await client.functions.invoke('export-my-data');
      if (res.data == null) {
        throw Exception('Empty response from export-my-data.');
      }
      // The Edge Function returns parsed JSON; re-encode for pretty
      // printing on disk so the user gets a readable file.
      final pretty = const JsonEncoder.withIndent('  ').convert(res.data);
      final dir = await getApplicationDocumentsDirectory();
      final stamp = DateTime.now().toUtc().toIso8601String().replaceAll(
        ':',
        '-',
      );
      final file = File('${dir.path}/hanguk-data-export-$stamp.json');
      await file.writeAsString(pretty);

      if (!mounted) return;
      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'application/json')],
        subject: 'Hanguk — your data export',
        text: 'Your Hanguk data export (JSON).',
      );
    } on FunctionException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocalizations.of(context)!.accountExportFailed(e.details),
            ),
          ),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context)!.accountExportFailed(e)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _signOut() async {
    setState(() => _signingOut = true);
    try {
      await ref.read(authRepositoryProvider).signOut();
      if (!mounted) return;
      // The router's redirect rule will send the user back to /welcome
      // automatically once the auth stream emits null. No explicit nav
      // needed.
    } finally {
      if (mounted) setState(() => _signingOut = false);
    }
  }

  Future<void> _showDeleteFlow() async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _DeleteConfirmDialog(),
    );
    if (confirmed != true) return;
    if (!mounted) return;

    // Show a non-dismissible progress dialog while the RPC runs.
    //
    // Captured before the await: the dialog is non-dismissible and blocks its
    // own pop, so if this screen unmounts mid-RPC a `mounted`-guarded
    // teardown would leave the user staring at a spinner they cannot escape
    // without force-quitting — during account deletion, of all things. The
    // root navigator outlives the screen, so hold it directly.
    final rootNavigator = Navigator.of(context, rootNavigator: true);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _DeletionProgressDialog(),
    );

    String? error;
    try {
      final client = Supabase.instance.client;
      await client.rpc<dynamic>('fn_delete_my_account');
    } on PostgrestException catch (e) {
      error = e.message;
    } on Exception catch (e) {
      error = e.toString();
    }

    // Tear down the progress dialog first, and unconditionally — see above.
    if (rootNavigator.canPop()) rootNavigator.pop();
    if (!mounted) return;

    if (error != null) {
      final l10n = AppLocalizations.of(context)!;
      final message = error;
      await showDialog<void>(
        context: context,
        builder: (ctx) => _SeoulDialog(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.accountDeleteErrorTitle,
                style: SeoulType.title.copyWith(color: SeoulColors.dangerText),
              ),
              const SizedBox(height: 12),
              Flexible(
                child: SingleChildScrollView(
                  child: Text(
                    l10n.accountDeleteErrorBody(message),
                    style: SeoulType.bodySecondary,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SeoulOutlineButton(
                label: l10n.ok,
                onPressed: () => Navigator.of(ctx).pop(),
              ),
            ],
          ),
        ),
      );
      return;
    }

    // Success path: server-side data is gone. Sign out so the router
    // redirects to /welcome; the auth row is anonymized by the RPC.
    await ref.read(authRepositoryProvider).signOut();
  }

  Future<void> _openLegal(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final user = ref.watch(authStateProvider).value?.session?.user;
    final email = user?.email;
    final phone = user?.phone;

    return SeoulNightScaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          SeoulSizes.screenPadding,
          12,
          SeoulSizes.screenPadding,
          32,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top bar — glass back circle + title with its hangul label,
            // matching the section headers in the Seoul Night shell.
            Row(
              children: [
                _GlassCircleButton(
                  icon: Icons.arrow_back_rounded,
                  tooltip: l10n.accountBackTooltip,
                  onTap: () => Navigator.of(context).maybePop(),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: HangulTag(
                    en: l10n.accountTitle,
                    ko: '계정',
                    titleStyle: SeoulType.title,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Identity — the one hero surface on this screen.
            HeroCard(
              watermark: '계정',
              child: Row(
                children: [
                  const HangulGlyphTile(glyph: '한', active: true),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(l10n.accountSignedInAs, style: SeoulType.eyebrow),
                        const SizedBox(height: 6),
                        Text(
                          email ?? phone ?? l10n.accountUnknownAccount,
                          style: SeoulType.subtitle,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            _AccountCard(
              glyph: '세',
              title: l10n.accountSessionLabel,
              ko: '세션',
              child: LimeButton(
                icon: Icons.logout_rounded,
                label: _signingOut
                    ? l10n.accountSigningOut
                    : l10n.accountSignOut,
                onPressed: _signingOut ? null : _signOut,
              ),
            ),

            const SizedBox(height: 16),

            // P1 #31: data-portability — PIPA + GDPR right.
            _AccountCard(
              glyph: '자',
              title: l10n.accountYourDataLabel,
              ko: '내 자료',
              body: l10n.accountYourDataBody,
              child: SeoulOutlineButton(
                icon: Icons.download_rounded,
                label: _exporting
                    ? l10n.accountPreparingExport
                    : l10n.accountDownloadMyData,
                onPressed: _exporting ? null : _exportMyData,
              ),
            ),

            const SizedBox(height: 16),

            _AccountCard(
              glyph: '삭',
              title: l10n.accountDangerZoneLabel,
              ko: '계정 삭제',
              body: l10n.accountDangerZoneBody,
              danger: true,
              child: _DangerButton(
                icon: Icons.delete_forever_rounded,
                label: l10n.accountDeleteAccount,
                onPressed: _showDeleteFlow,
              ),
            ),

            const SizedBox(height: 24),

            // Legal footer. Links are white w/ underline on dark; lime is
            // reserved for actions/active states only (audit A5/C2).
            // Wrap, not Row: some locales run long enough to overflow.
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _LegalLink(
                  label: l10n.accountPrivacyPolicy,
                  onTap: () => _openLegal(AppConfig.privacyPolicyUrl),
                ),
                const Text(' • ', style: SeoulType.bodySecondary),
                _LegalLink(
                  label: l10n.accountTermsOfService,
                  onTap: () => _openLegal(AppConfig.termsOfServiceUrl),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// One settings block: hangul glyph tile, title + lime hangul label,
/// optional explanatory body, and the action itself.
class _AccountCard extends StatelessWidget {
  const _AccountCard({
    required this.glyph,
    required this.title,
    required this.ko,
    required this.child,
    this.body,
    this.danger = false,
  });

  final String glyph;
  final String title;
  final String ko;
  final Widget child;
  final String? body;

  /// Tints the header amber and the hairline warning-coloured. Used by the
  /// delete-account block only.
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(18),
      borderColor: danger ? SeoulColors.danger.withValues(alpha: 0.45) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              HangulGlyphTile(glyph: glyph, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: danger
                          ? SeoulType.subtitle.copyWith(
                              color: SeoulColors.dangerText,
                            )
                          : SeoulType.subtitle,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      ko,
                      style: danger
                          ? SeoulType.hangulLabel.copyWith(
                              color: SeoulColors.dangerText,
                            )
                          : SeoulType.hangulLabel,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (body != null) ...[
            const SizedBox(height: 12),
            Text(body!, style: SeoulType.bodySecondary.copyWith(fontSize: 13)),
          ],
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

/// 44px glass circle holding one icon — the back affordance used across the
/// Seoul Night shell (spec §2).
class _GlassCircleButton extends StatelessWidget {
  const _GlassCircleButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: Tooltip(
        message: tooltip,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: SeoulSizes.minTapTarget,
            height: SeoulSizes.minTapTarget,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: SeoulColors.glass,
              border: Border.all(color: SeoulColors.glassBorder),
            ),
            child: Icon(icon, size: 20, color: SeoulColors.textPrimary),
          ),
        ),
      ),
    );
  }
}

class _LegalLink extends StatelessWidget {
  const _LegalLink({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        foregroundColor: SeoulColors.textSecondary,
        minimumSize: const Size(
          SeoulSizes.minTapTarget,
          SeoulSizes.minTapTarget,
        ),
      ),
      child: Text(
        label,
        style: SeoulType.bodySecondary.copyWith(
          decoration: TextDecoration.underline,
          decorationColor: SeoulColors.textSecondary,
        ),
      ),
    );
  }
}

/// The destructive action. `SeoulColors.danger*` fill + hairline — the
/// desaturated destructive tone, never a raw red hex.
class _DangerButton extends StatefulWidget {
  const _DangerButton({required this.label, this.onPressed, this.icon});

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  State<_DangerButton> createState() => _DangerButtonState();
}

class _DangerButtonState extends State<_DangerButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;

    final button = AnimatedOpacity(
      opacity: enabled ? 1.0 : 0.45,
      duration: SeoulMotion.fast,
      child: Container(
        height: SeoulSizes.buttonHeight,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: SeoulColors.dangerFill,
          borderRadius: SeoulRadii.controlR,
          border: Border.all(color: SeoulColors.danger, width: 1),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (widget.icon != null) ...[
              Icon(widget.icon, size: 18, color: SeoulColors.dangerText),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Text(
                widget.label,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: SeoulType.button.copyWith(color: SeoulColors.dangerText),
              ),
            ),
          ],
        ),
      ),
    );

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        onTap: widget.onPressed,
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        child: AnimatedScale(
          scale: _pressed ? SeoulMotion.pressScale : 1.0,
          duration: SeoulMotion.fast,
          curve: SeoulMotion.smooth,
          child: button,
        ),
      ),
    );
  }
}

/// Modal shell for Seoul Night: the app background gradient behind a hero
/// hairline and shadow, so a dialog reads as a raised slice of the app
/// rather than a flat Material panel.
class _SeoulDialog extends StatelessWidget {
  const _SeoulDialog({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
      child: Container(
        decoration: BoxDecoration(
          gradient: SeoulGradients.appBackground,
          borderRadius: SeoulRadii.heroR,
          border: Border.all(color: SeoulColors.heroBorder, width: 1),
          boxShadow: SeoulShadows.hero,
        ),
        child: ClipRRect(
          borderRadius: SeoulRadii.heroR,
          child: Padding(padding: const EdgeInsets.all(20), child: child),
        ),
      ),
    );
  }
}

class _DeleteConfirmDialog extends StatefulWidget {
  const _DeleteConfirmDialog();

  @override
  State<_DeleteConfirmDialog> createState() => _DeleteConfirmDialogState();
}

class _DeleteConfirmDialogState extends State<_DeleteConfirmDialog> {
  final _confirmCtrl = TextEditingController();
  bool _canConfirm = false;

  @override
  void initState() {
    super.initState();
    _confirmCtrl.addListener(() {
      final next = _confirmCtrl.text.trim().toUpperCase() == 'DELETE';
      if (next != _canConfirm) setState(() => _canConfirm = next);
    });
  }

  @override
  void dispose() {
    _confirmCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return _SeoulDialog(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const HangulGlyphTile(glyph: '삭', size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  l10n.accountDeleteDialogTitle,
                  style: SeoulType.subtitle.copyWith(
                    color: SeoulColors.dangerText,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Flexible(
            child: SingleChildScrollView(
              child: Text(
                l10n.accountDeleteDialogBody,
                style: SeoulType.bodySecondary,
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _confirmCtrl,
            textCapitalization: TextCapitalization.characters,
            style: SeoulType.codeInput,
            textAlign: TextAlign.center,
            cursorColor: SeoulColors.lime,
            decoration: InputDecoration(
              // Hint is the literal sentinel string the controller compares
              // against — must NOT be translated.
              hintText: 'DELETE',
              hintStyle: SeoulType.codeInput.copyWith(
                color: SeoulColors.textFaint,
              ),
              filled: true,
              fillColor: SeoulColors.glass,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 14,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: SeoulRadii.controlR,
                borderSide: const BorderSide(color: SeoulColors.glassBorder),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: SeoulRadii.controlR,
                borderSide: const BorderSide(color: SeoulColors.danger),
              ),
              border: OutlineInputBorder(
                borderRadius: SeoulRadii.controlR,
                borderSide: const BorderSide(color: SeoulColors.glassBorder),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: SeoulOutlineButton(
                  label: l10n.cancel,
                  onPressed: () => Navigator.of(context).pop(false),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _DangerButton(
                  label: l10n.accountDeleteDialogConfirm,
                  onPressed: _canConfirm
                      ? () => Navigator.of(context).pop(true)
                      : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DeletionProgressDialog extends StatelessWidget {
  const _DeletionProgressDialog();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return PopScope(
      canPop: false,
      child: _SeoulDialog(
        child: Row(
          children: [
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
              ),
            ),
            const SizedBox(width: 16),
            Flexible(
              child: Text(l10n.accountDeleteProgress, style: SeoulType.body),
            ),
          ],
        ),
      ),
    );
  }
}
