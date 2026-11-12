import 'package:flutter/material.dart';

import '../../../core/format/digit_mask.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/brand.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/forms.dart';
import '../../../design/widgets/layout.dart';
import '../../../design/widgets/link_text.dart';
import '../biz.dart';
import '../language.dart';

/// BA0 «App Login»: the owner's mobile number; «시작하기» sends an SMS code
/// (P54, Twilio Verify) and the business opens at once after it. No
/// 사업자등록번호 (P50, Asrbek).
class Ba0LoginScreen extends StatefulWidget {
  const Ba0LoginScreen({super.key, this.onStart, this.onTerms});

  /// "시작하기" with the formatted phone; the button waits while it runs.
  final Future<void> Function(String phone)? onStart;

  /// The "이용약관" link.
  final VoidCallback? onTerms;

  @override
  State<Ba0LoginScreen> createState() => _Ba0LoginScreenState();
}

class _Ba0LoginScreenState extends State<Ba0LoginScreen> {
  final _phone = TextEditingController();
  final _phoneMask = DigitGroupsFormatter.koreanMobile();
  bool _starting = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    final start = widget.onStart;
    if (start == null || _starting) return;
    setState(() => _starting = true);
    try {
      await start(_phone.text);
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.entry,
        watermark: '사장님',
        watermarkSize: 150,
        child: Stack(
          children: [
            Positioned.fill(child: _layout(context)),
            // P43: the app's language, before anything else.
            Positioned(
              top: HiInsets.top(context, 52),
              right: 22,
              child: const EmployerLanguageButton(size: 44),
            ),
          ],
        ),
      ),
    );
  }

  Widget _layout(BuildContext context) {
    return HiPinnedBottomLayout(
          top: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
          Padding(
            padding: EdgeInsets.fromLTRB(
              18,
              HiInsets.top(context, 96),
              22,
              0,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const HiBrandTile(),
                const SizedBox(height: 20),
                // One line as in the prototype; a longer badge
                // («Для работодателя») goes under the name on a narrow
                // screen instead of off it.
                Wrap(
                  spacing: 10,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Semantics(
                      header: true,
                      child: HiText(
                        'Hanguk Ish',
                        style: hiStyle(
                          34,
                          FontWeight.w800,
                          height: 1.1,
                          letterSpacingEm: -0.02,
                          color: HiColors.white,
                        ),
                      ),
                    ),
                    HiNavyPill(Biz.ownerBadge),
                  ],
                ),
                const SizedBox(height: 14),
                HiText(
                  Biz.loginSubtitle,
                  style: hiStyle(
                    17,
                    FontWeight.w600,
                    height: 1.5,
                    color: HiColors.textSoft,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 40, 22, 0),
            child: AutofillGroup(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  HiText(
                    Biz.phoneLabel,
                    style: hiStyle(15, FontWeight.w700, color: HiColors.textSoft),
                  ),
                  const SizedBox(height: 8),
                  HiInputField(
                    controller: _phone,
                    mono: true,
                    placeholder: Biz.phonePlaceholder,
                    keyboardType: TextInputType.phone,
                    autofillHints: const [AutofillHints.telephoneNumber],
                    inputFormatters: [_phoneMask],
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _start(),
                  ),
                ],
              ),
            ),
          ),
            ],
          ),
          bottom: Padding(
            padding: EdgeInsets.fromLTRB(
              18,
              24,
              22,
              HiInsets.bottom(context, 30),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                HiButton(
                  label: Biz.start,
                  height: 56,
                  fontSize: 18,
                  onPressed: _starting ? null : _start,
                ),
                const SizedBox(height: 14),
                HiLinkSentence(
                  prefix: Biz.termsPrefix,
                  link: Biz.termsLink,
                  suffix: Biz.termsSuffix,
                  style: hiStyle(
                    14,
                    FontWeight.w400,
                    height: 1.5,
                    color: HiColors.textMuted,
                  ),
                  linkStyle: hiStyle(
                    14,
                    FontWeight.w700,
                    height: 1.5,
                    color: HiColors.white,
                  ),
                  onLink: widget.onTerms ?? () {},
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        );
  }
}
