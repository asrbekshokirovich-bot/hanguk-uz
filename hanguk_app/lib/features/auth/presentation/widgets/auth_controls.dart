import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import 'sign_in_chrome.dart';

// Controls shared by the sign-in screens: Magic Code (`login_screen.dart`),
// and the phone sign-up and sign-in screens under `features/entry`.

/// 40px glass square with a chevron. The tap target is [tapSlack] larger to
/// the end and bottom, so it clears 44px without changing what is drawn or
/// where.
class AuthBackButton extends StatelessWidget {
  const AuthBackButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  static const double _size = 40;
  static const double _radius = 12;
  static const double tapSlack = 4;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: MaterialLocalizations.of(context).backButtonTooltip,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPressed,
        child: SizedBox.square(
          dimension: _size + tapSlack,
          child: Align(
            alignment: AlignmentDirectional.topStart,
            child: Container(
              width: _size,
              height: _size,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color.fromRGBO(255, 255, 255, .06),
                borderRadius: BorderRadius.circular(_radius),
                border: Border.all(
                  color: const Color.fromRGBO(255, 255, 255, .12),
                ),
              ),
              foregroundDecoration: const InsetEdgesDecoration(
                radius: _radius,
                top: Color.fromRGBO(255, 255, 255, .08),
                inset: 1,
              ),
              child: const SignInIconView(
                SignInIcon.chevronLeft,
                size: 20,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The primary action: lime gradient, ink label, a white top highlight and a
/// soft lime drop shadow. Loading swaps the label for an ink spinner and
/// blocks taps, like [LimeButton].
class AuthSubmitButton extends StatefulWidget {
  const AuthSubmitButton({
    super.key,
    required this.label,
    required this.loading,
    required this.onPressed,
  });

  final String label;
  final bool loading;
  final VoidCallback onPressed;

  @override
  State<AuthSubmitButton> createState() => _AuthSubmitButtonState();
}

class _AuthSubmitButtonState extends State<AuthSubmitButton> {
  static const double _height = 56;
  static const double _radius = 16;

  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = !widget.loading;

    final content = widget.loading
        ? const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2.2,
              valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.ink),
            ),
          )
        : Text(
            widget.label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontFamily: SeoulType.inter,
              fontFamilyFallback: SeoulType.fallback,
              fontSize: 16,
              height: 1.21, // `line-height: normal` for Inter
              fontWeight: FontWeight.w700,
              color: SeoulColors.ink,
            ),
          );

    final button = AnimatedOpacity(
      opacity: enabled ? 1.0 : 0.45,
      duration: SeoulMotion.fast,
      child: Container(
        height: _height,
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFDDF05E), Color(0xFFD4E94C)],
          ),
          borderRadius: BorderRadius.circular(_radius),
          boxShadow: enabled
              ? [
                  BoxShadow(
                    color: const Color.fromRGBO(168, 192, 20, .22),
                    offset: const Offset(0, 10),
                    blurRadius: cssBlur(24),
                  ),
                ]
              : null,
        ),
        foregroundDecoration: const InsetEdgesDecoration(
          radius: _radius,
          top: Color.fromRGBO(255, 255, 255, .55),
        ),
        child: content,
      ),
    );

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        onTap: enabled ? widget.onPressed : null,
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

/// Inline error / success banner.
///
/// The tint is a *text* colour on the Seoul Night navy, so it has to be the
/// light end of the semantic pair: `AppColors.error` (#DC2626) measures about
/// 2.1:1 here, well under AA, which would leave the one message explaining a
/// failed sign-in barely readable.
class AuthMessageCard extends StatelessWidget {
  const AuthMessageCard({
    super.key,
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
