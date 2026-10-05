import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../auth/presentation/widgets/sign_in_chrome.dart';

/// Uzbek mobile numbers only: nine digits after the fixed +998.
const int kUzNationalDigits = 9;

/// `901234567` → `+998901234567`.
String uzE164(String national) => '+998$national';

/// Keeps the nine digits after +998 and spaces them as they are read aloud:
/// `90 123 45 67`. Pasting a full `+998 90 123 45 67` keeps the last nine.
class UzPhoneFormatter extends TextInputFormatter {
  const UzPhoneFormatter();

  static String digitsOf(String text) {
    var d = text.replaceAll(RegExp(r'\D'), '');
    if (d.length > kUzNationalDigits && d.startsWith('998')) d = d.substring(3);
    return d.length > kUzNationalDigits ? d.substring(0, kUzNationalDigits) : d;
  }

  static String format(String digits) {
    final b = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i == 2 || i == 5 || i == 7) b.write(' ');
      b.write(digits[i]);
    }
    return b.toString();
  }

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final text = format(digitsOf(newValue.text));
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// A labelled glass input in the Magic Code field's style: glass fill, a
/// hairline border that turns lime while focused, and the lime ring outside
/// it. [invalid] turns the border to the danger tint.
class EntryField extends StatefulWidget {
  const EntryField({
    super.key,
    required this.label,
    required this.controller,
    this.prefix,
    this.hint,
    this.obscure = false,
    this.keyboardType,
    this.inputFormatters,
    this.autofillHints,
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
    this.invalid = false,
    this.revealLabel,
    this.hideLabel,
  });

  final String label;
  final TextEditingController controller;

  /// Fixed text before the input, e.g. `+998`.
  final String? prefix;
  final String? hint;

  /// A password: hidden, with an eye button that shows it.
  final bool obscure;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final Iterable<String>? autofillHints;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;
  final bool invalid;

  /// Screen-reader labels of the eye button, when [obscure].
  final String? revealLabel;
  final String? hideLabel;

  @override
  State<EntryField> createState() => _EntryFieldState();
}

class _EntryFieldState extends State<EntryField> {
  static const double _height = 58;
  static const double _radius = 16;
  static const double _border = 1.5;

  final FocusNode _focus = FocusNode();
  late bool _hidden = widget.obscure;

  static const TextStyle _inputStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: 17,
    height: 1.21,
    fontWeight: FontWeight.w600,
    color: Colors.white,
  );

  static const TextStyle _labelStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: 13,
    height: 1.21,
    fontWeight: FontWeight.w600,
    color: Color.fromRGBO(255, 255, 255, .72),
  );

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
    final active = _focus.hasFocus;
    final Color border = widget.invalid
        ? SeoulColors.dangerText
        : active
        ? SeoulColors.lime
        : const Color.fromRGBO(255, 255, 255, .12);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(widget.label, style: _labelStyle),
        ),
        AnimatedContainer(
          duration: SeoulMotion.base,
          curve: SeoulMotion.smooth,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(_radius),
            border: Border.all(
              color: active && !widget.invalid
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
              border: Border.all(color: border, width: _border),
            ),
            foregroundDecoration: const InsetEdgesDecoration(
              radius: _radius,
              top: Color.fromRGBO(255, 255, 255, .08),
              inset: _border,
            ),
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _focus.requestFocus,
              child: Row(
                children: [
                  const SizedBox(width: 18),
                  if (widget.prefix != null) ...[
                    Text(
                      widget.prefix!,
                      style: _inputStyle.copyWith(
                        color: const Color.fromRGBO(255, 255, 255, .64),
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: TextField(
                      controller: widget.controller,
                      focusNode: _focus,
                      obscureText: _hidden,
                      enableSuggestions: !widget.obscure,
                      autocorrect: false,
                      keyboardType: widget.keyboardType,
                      inputFormatters: widget.inputFormatters,
                      autofillHints: widget.autofillHints,
                      textInputAction: widget.textInputAction,
                      onSubmitted: widget.onSubmitted,
                      style: _inputStyle,
                      cursorColor: SeoulColors.lime,
                      scrollPadding: const EdgeInsets.fromLTRB(20, 20, 20, 160),
                      decoration: InputDecoration(
                        isCollapsed: true,
                        hintText: widget.hint,
                        hintStyle: _inputStyle.copyWith(
                          color: const Color.fromRGBO(255, 255, 255, .3),
                        ),
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                      ),
                    ),
                  ),
                  if (widget.obscure)
                    Semantics(
                      button: true,
                      label: _hidden ? widget.revealLabel : widget.hideLabel,
                      excludeSemantics: true,
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => setState(() => _hidden = !_hidden),
                        child: SizedBox.square(
                          dimension: _height - 2 * _border,
                          child: Icon(
                            _hidden
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            size: 22,
                            color: const Color.fromRGBO(255, 255, 255, .64),
                          ),
                        ),
                      ),
                    )
                  else
                    const SizedBox(width: 18),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A lime text link on the navy backdrop, e.g. "Sign in" after "Have an
/// account?". [lead] is the plain text before it.
class EntryLink extends StatelessWidget {
  const EntryLink({
    super.key,
    this.lead,
    required this.label,
    required this.onTap,
  });

  final String? lead;
  final String label;
  final VoidCallback onTap;

  static const TextStyle _style = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: 14,
    height: 1.21,
    fontWeight: FontWeight.w400,
    color: Color.fromRGBO(255, 255, 255, .72),
  );

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: [?lead, label].join(' '),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text.rich(
            TextSpan(
              children: [
                if (lead != null) TextSpan(text: '$lead '),
                TextSpan(
                  text: label,
                  style: const TextStyle(
                    color: SeoulColors.lime,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            textAlign: TextAlign.center,
            style: _style,
          ),
        ),
      ),
    );
  }
}
