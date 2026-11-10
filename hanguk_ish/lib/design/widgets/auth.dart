import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../insets.dart';
import '../tokens.dart';
import '../typography.dart';
import 'backdrop.dart';
import 'buttons.dart';
import 'forms.dart';
import 'layout.dart';

/// T1 / T2 (phone sign-in, both apps): A02's step layout on the entry
/// backdrop — back button and a small title, the heading and its line, the
/// form, the action pinned at the bottom. Not in the prototype (T1–T3 are
/// drawn for approval); built from its parts.
class HiAuthFrame extends StatelessWidget {
  const HiAuthFrame({
    super.key,
    required this.topTitle,
    required this.title,
    required this.subtitle,
    required this.onBack,
    required this.children,
    required this.action,
    required this.onAction,
    this.busy = false,
    this.watermark,
  });

  final String topTitle;
  final String title;
  final String subtitle;
  final VoidCallback? onBack;
  final List<Widget> children;
  final String action;

  /// Null while the form is not ready (the button is shown disabled).
  final VoidCallback? onAction;

  /// A request is on its way: the button waits.
  final bool busy;
  final String? watermark;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.entry,
        watermark: watermark,
        watermarkSize: 150,
        child: HiPinnedBottomLayout(
          top: Padding(
            padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                HiTopBar(title: topTitle, onBack: onBack),
                const SizedBox(height: 28),
                Semantics(
                  header: true,
                  child: HiText(
                    title,
                    style: hiStyle(28, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02),
                  ),
                ),
                const SizedBox(height: 10),
                HiText(subtitle, style: hiStyle(16, FontWeight.w500, height: 1.45, color: HiColors.textSoft)),
                const SizedBox(height: 28),
                ...children,
              ],
            ),
          ),
          bottom: Padding(
            padding: EdgeInsets.fromLTRB(18, 16, 22, HiInsets.bottom(context, 30)),
            child: HiButton(label: action, onPressed: busy ? null : onAction),
          ),
        ),
      ),
    );
  }
}

/// A refusal under a form: the red soft card of the design system.
class HiFormError extends StatelessWidget {
  const HiFormError(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          color: HiColors.redSoft,
          borderRadius: BorderRadius.circular(HiRadii.button),
          border: const Border.fromBorderSide(HiBorders.ink),
        ),
        child: HiText(text, style: hiStyle(14, FontWeight.w700, height: 1.4, color: HiColors.redInk)),
      ),
    );
  }
}

/// The 6-digit SMS code: one wide monospaced field that the phone can fill
/// from the SMS (one-time-code autofill); [onCompleted] fires at six digits.
class HiCodeField extends StatelessWidget {
  const HiCodeField({
    super.key,
    required this.controller,
    required this.onCompleted,
    this.focusNode,
    this.semanticsLabel,
  });

  final TextEditingController controller;
  final ValueChanged<String> onCompleted;
  final FocusNode? focusNode;
  final String? semanticsLabel;

  static const length = 6;

  @override
  Widget build(BuildContext context) {
    final style = hiStyle(26, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono, letterSpacingEm: 0.35);
    return Semantics(
      label: semanticsLabel,
      textField: true,
      child: Container(
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.circular(HiRadii.field),
          border: const Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        alignment: Alignment.center,
        child: TextField(
          controller: controller,
          focusNode: focusNode,
          autofocus: true,
          style: style,
          strutStyle: hiStrut(style),
          textAlign: TextAlign.center,
          cursorColor: HiColors.ink,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.oneTimeCode],
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(length)],
          maxLines: 1,
          decoration: InputDecoration.collapsed(
            hintText: '••••••',
            hintStyle: style.copyWith(color: HiColors.inkMuted.withValues(alpha: 0.5)),
          ),
          onChanged: (value) {
            if (value.length == length) onCompleted(value);
          },
          onSubmitted: (value) {
            if (value.length == length) onCompleted(value);
          },
        ),
      ),
    );
  }
}

/// Texts of [HiPhoneCodeScreen] in the app's language.
class HiPhoneCodeTexts {
  const HiPhoneCodeTexts({
    required this.topTitle,
    required this.title,
    required this.subtitle,
    required this.label,
    required this.action,
    required this.resend,
    required this.resendIn,
    required this.resent,
  });

  final String topTitle;
  final String title;
  final String subtitle;
  final String label;
  final String action;
  final String resend;
  final String Function(String time) resendIn;
  final String resent;
}

/// T2: the SMS code. [verify] signs in (or throws); [resend] texts a new
/// code — offered after [resendAfter]; [errorText] names a failure.
class HiPhoneCodeScreen extends StatefulWidget {
  const HiPhoneCodeScreen({
    super.key,
    required this.texts,
    required this.onBack,
    required this.verify,
    required this.resend,
    required this.errorText,
    required this.onVerified,
    this.resendAfter = const Duration(seconds: 60),
    this.watermark,
  });

  final HiPhoneCodeTexts texts;
  final VoidCallback onBack;
  final Future<void> Function(String code) verify;
  final Future<void> Function() resend;
  final String Function(Object error) errorText;
  final VoidCallback onVerified;
  final Duration resendAfter;
  final String? watermark;

  @override
  State<HiPhoneCodeScreen> createState() => _HiPhoneCodeScreenState();
}

class _HiPhoneCodeScreenState extends State<HiPhoneCodeScreen> {
  final _code = TextEditingController();
  Timer? _timer;
  int _left = 0;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void initState() {
    super.initState();
    _code.addListener(() => setState(() {}));
    _countDown();
  }

  void _countDown() {
    _timer?.cancel();
    _left = widget.resendAfter.inSeconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _left--);
      if (_left <= 0) timer.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  Future<void> _verify([String? value]) async {
    final code = value ?? _code.text;
    if (_busy || code.length != HiCodeField.length) return;
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    try {
      await widget.verify(code);
      if (mounted) widget.onVerified();
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = widget.errorText(error));
      _code.clear();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    try {
      await widget.resend();
      if (!mounted) return;
      setState(() => _info = widget.texts.resent);
      _countDown();
    } catch (error) {
      if (mounted) setState(() => _error = widget.errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.texts;
    final time = '${_left ~/ 60}:${(_left % 60).toString().padLeft(2, '0')}';
    final error = _error;
    final info = _info;
    return HiAuthFrame(
      topTitle: t.topTitle,
      title: t.title,
      subtitle: t.subtitle,
      onBack: widget.onBack,
      action: t.action,
      onAction: _code.text.length == HiCodeField.length ? _verify : null,
      busy: _busy,
      watermark: widget.watermark,
      children: [
        HiFieldLabel(t.label),
        const SizedBox(height: 8),
        HiCodeField(controller: _code, onCompleted: _verify, semanticsLabel: t.label),
        const SizedBox(height: 16),
        if (_left > 0)
          HiText(t.resendIn(time), style: hiStyle(15, FontWeight.w600, color: HiColors.textMuted))
        else
          Align(
            alignment: Alignment.centerLeft,
            child: HiButton(
              label: t.resend,
              style: HiButtonStyle.text,
              textColor: HiColors.white,
              height: 44,
              fontSize: 15,
              horizontalPadding: 4,
              onPressed: _busy ? null : _resend,
            ),
          ),
        if (info != null) ...[
          const SizedBox(height: 8),
          HiText(info, style: hiStyle(15, FontWeight.w600, color: HiColors.lime)),
        ],
        if (error != null) ...[
          const SizedBox(height: 16),
          HiFormError(error),
        ],
      ],
    );
  }
}
