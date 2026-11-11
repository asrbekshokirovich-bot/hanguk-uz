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

/// BA0 «App Login»: owner's mobile number and business registration number.
class Ba0LoginScreen extends StatefulWidget {
  const Ba0LoginScreen({super.key, this.onStart, this.onTerms});

  /// "시작하기" with the formatted phone and business number. Wired to the
  /// sign-in and 국세청 check in P6.
  final void Function(String phone, String businessNumber)? onStart;

  /// The "이용약관" link.
  final VoidCallback? onTerms;

  @override
  State<Ba0LoginScreen> createState() => _Ba0LoginScreenState();
}

class _Ba0LoginScreenState extends State<Ba0LoginScreen> {
  final _phone = TextEditingController();
  final _bizNo = TextEditingController();
  final _phoneMask = DigitGroupsFormatter.koreanMobile();
  final _bizNoMask = DigitGroupsFormatter.businessNumber();

  @override
  void dispose() {
    _phone.dispose();
    _bizNo.dispose();
    super.dispose();
  }

  void _start() {
    widget.onStart?.call(_phone.text, _bizNo.text);
  }

  @override
  Widget build(BuildContext context) {
    final label = hiStyle(15, FontWeight.w700, color: HiColors.textSoft);
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.entry,
        watermark: '사장님',
        watermarkSize: 150,
        child: Stack(
          children: [
            Positioned.fill(child: _layout(context, label)),
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

  Widget _layout(BuildContext context, TextStyle label) {
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
                    Row(
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
                        const SizedBox(width: 10),
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
                      HiText(Biz.phoneLabel, style: label),
                      const SizedBox(height: 8),
                      HiInputField(
                        controller: _phone,
                        mono: true,
                        placeholder: Biz.phonePlaceholder,
                        keyboardType: TextInputType.phone,
                        autofillHints: const [AutofillHints.telephoneNumber],
                        inputFormatters: [_phoneMask],
                      ),
                      const SizedBox(height: 18),
                      HiText(Biz.bizNoLabel, style: label),
                      const SizedBox(height: 8),
                      HiInputField(
                        controller: _bizNo,
                        mono: true,
                        keyboardType: TextInputType.number,
                        placeholder: Biz.bizNoPlaceholder,
                        inputFormatters: [_bizNoMask],
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _start(),
                      ),
                      const SizedBox(height: 8),
                      HiText(
                        Biz.bizNoHint,
                        style: hiStyle(
                          14,
                          FontWeight.w600,
                          color: HiColors.textMuted,
                        ),
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
              // Keeps the block clear of the form on short screens.
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
                  onPressed: _start,
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
