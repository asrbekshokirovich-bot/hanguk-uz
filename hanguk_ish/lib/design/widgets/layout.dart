import 'package:flutter/widgets.dart';

/// The prototype's screen layout: content from the top, and a block pinned
/// to the bottom edge (`position:absolute; bottom:0`).
///
/// On a phone tall enough the bottom block sits at the bottom as in the
/// prototype; on a shorter one the whole screen scrolls instead of the two
/// overlapping. Built from slivers so the top content is laid out normally
/// (no intrinsic measuring, which mis-sizes `max-width` text).
class HiPinnedBottomLayout extends StatelessWidget {
  const HiPinnedBottomLayout({
    super.key,
    required this.top,
    required this.bottom,
  });

  final Widget top;
  final Widget bottom;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: top),
        SliverFillRemaining(
          hasScrollBody: false,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [bottom],
          ),
        ),
      ],
    );
  }
}
