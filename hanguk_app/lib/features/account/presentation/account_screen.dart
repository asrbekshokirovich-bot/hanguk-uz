import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../design_system/adaptive/hanguk_card.dart';
import '../../../design_system/adaptive/hanguk_scaffold.dart';
import '../../../design_system/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/data/auth_repository.dart';

/// Account management screen — sign out and (irreversibly) delete the
/// account. The deletion flow is required by both Apple App Store
/// (Guideline 5.1.1(v)) and Google Play (User Data policy, 2024+) for
/// any app that supports account creation.
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

    if (!mounted) return;
    // Tear down the progress dialog regardless.
    Navigator.of(context, rootNavigator: true).pop();

    if (error != null) {
      final l10n = AppLocalizations.of(context)!;
      final message = error;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF132A4D),
          title: Text(
            l10n.accountDeleteErrorTitle,
            style: const TextStyle(color: Colors.white),
          ),
          content: Text(
            l10n.accountDeleteErrorBody(message),
            style: const TextStyle(color: Colors.white70),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(l10n.ok),
            ),
          ],
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

    return HangukScaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top bar
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    tooltip: l10n.accountBackTooltip,
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    l10n.accountTitle,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              HangukCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.accountSignedInAs,
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      email ?? phone ?? l10n.accountUnknownAccount,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              HangukCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      l10n.accountSessionLabel,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      icon: const Icon(Icons.logout),
                      label: Text(
                        _signingOut
                            ? l10n.accountSigningOut
                            : l10n.accountSignOut,
                      ),
                      onPressed: _signingOut ? null : _signOut,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.08),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // P1 #31: data-portability — PIPA + GDPR right.
              HangukCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      l10n.accountYourDataLabel,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      l10n.accountYourDataBody,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      icon: const Icon(Icons.download),
                      label: Text(
                        _exporting
                            ? l10n.accountPreparingExport
                            : l10n.accountDownloadMyData,
                      ),
                      onPressed: _exporting ? null : _exportMyData,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.08),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              HangukCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      l10n.accountDangerZoneLabel,
                      style: const TextStyle(
                        color: Colors.redAccent,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      l10n.accountDangerZoneBody,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      icon: const Icon(Icons.delete_forever),
                      label: Text(l10n.accountDeleteAccount),
                      onPressed: _showDeleteFlow,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.redAccent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Legal footer
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () => _openLegal(AppConfig.privacyPolicyUrl),
                    child: Text(
                      l10n.accountPrivacyPolicy,
                      // Links are white w/ underline on dark; lime is reserved
                      // for actions/active states only (audit A5/C2).
                      style: const TextStyle(
                        color: Colors.white70,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                  const Text(' • ', style: TextStyle(color: Colors.white70)),
                  TextButton(
                    onPressed: () => _openLegal(AppConfig.termsOfServiceUrl),
                    child: Text(
                      l10n.accountTermsOfService,
                      style: const TextStyle(
                        color: Colors.white70,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
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
    return AlertDialog(
      backgroundColor: const Color(0xFF132A4D),
      title: Text(
        l10n.accountDeleteDialogTitle,
        style: const TextStyle(color: Colors.white),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.accountDeleteDialogBody,
            style: const TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _confirmCtrl,
            textCapitalization: TextCapitalization.characters,
            style: const TextStyle(color: Colors.white, letterSpacing: 2),
            decoration: InputDecoration(
              // Hint is the literal sentinel string the controller compares
              // against — must NOT be translated.
              hintText: 'DELETE',
              hintStyle: const TextStyle(color: Colors.white70),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.06),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l10n.cancel),
        ),
        ElevatedButton(
          onPressed: _canConfirm ? () => Navigator.of(context).pop(true) : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.redAccent,
            foregroundColor: Colors.white,
            disabledBackgroundColor: Colors.redAccent.withValues(alpha: 0.3),
          ),
          child: Text(l10n.accountDeleteDialogConfirm),
        ),
      ],
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
      child: AlertDialog(
        backgroundColor: const Color(0xFF132A4D),
        content: Row(
          children: [
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.vibrantLime,
              ),
            ),
            const SizedBox(width: 16),
            Flexible(
              child: Text(
                l10n.accountDeleteProgress,
                style: const TextStyle(color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
