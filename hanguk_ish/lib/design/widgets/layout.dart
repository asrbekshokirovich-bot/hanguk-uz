import 'package:flutter/rendering.dart';
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

/// Two items on one line, the second pushed to the end — CSS
/// `display:flex; gap` with `margin-left:auto` on the second item.
///
/// Like CSS, a second item that does not quite fit (by up to
/// [overflowAllowance], e.g. a pixel of text-width rounding) stays on the
/// line right after the first one, running into the padding; one that is
/// much too wide (a longer translation) moves to its own line instead of
/// spilling out of the card.
class HiSplitRow extends MultiChildRenderObjectWidget {
  HiSplitRow({
    super.key,
    required Widget start,
    required Widget end,
    this.gap = 8,
    this.runGap = 8,
    this.overflowAllowance = 4,
  }) : super(children: [start, end]);

  final double gap;
  final double runGap;
  final double overflowAllowance;

  @override
  RenderHiSplitRow createRenderObject(BuildContext context) =>
      RenderHiSplitRow(gap: gap, runGap: runGap, overflowAllowance: overflowAllowance);

  @override
  void updateRenderObject(BuildContext context, RenderHiSplitRow renderObject) {
    renderObject
      ..gap = gap
      ..runGap = runGap
      ..overflowAllowance = overflowAllowance;
  }
}

class _SplitParentData extends ContainerBoxParentData<RenderBox> {}

/// Render object of [HiSplitRow].
class RenderHiSplitRow extends RenderBox
    with ContainerRenderObjectMixin<RenderBox, _SplitParentData>, RenderBoxContainerDefaultsMixin<RenderBox, _SplitParentData> {
  RenderHiSplitRow({required double gap, required double runGap, required double overflowAllowance})
      : _gap = gap,
        _runGap = runGap,
        _overflowAllowance = overflowAllowance;

  double _gap;
  double _runGap;
  double _overflowAllowance;

  set gap(double v) {
    if (v == _gap) return;
    _gap = v;
    markNeedsLayout();
  }

  set runGap(double v) {
    if (v == _runGap) return;
    _runGap = v;
    markNeedsLayout();
  }

  set overflowAllowance(double v) {
    if (v == _overflowAllowance) return;
    _overflowAllowance = v;
    markNeedsLayout();
  }

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _SplitParentData) child.parentData = _SplitParentData();
  }

  Size _layout(BoxConstraints constraints, {required bool dry}) {
    final start = firstChild!;
    final end = childAfter(start)!;
    final loose = BoxConstraints(maxHeight: constraints.maxHeight);
    final Size s;
    final Size e;
    if (dry) {
      s = start.getDryLayout(loose);
      e = end.getDryLayout(loose);
    } else {
      start.layout(loose, parentUsesSize: true);
      end.layout(loose, parentUsesSize: true);
      s = start.size;
      e = end.size;
    }
    final width = constraints.hasBoundedWidth ? constraints.maxWidth : s.width + _gap + e.width;
    final oneLine = s.width + _gap + e.width <= width + _overflowAllowance;
    final height = oneLine ? (s.height > e.height ? s.height : e.height) : s.height + _runGap + e.height;
    if (!dry) {
      final sp = start.parentData! as _SplitParentData;
      final ep = end.parentData! as _SplitParentData;
      if (oneLine) {
        sp.offset = Offset(0, (height - s.height) / 2);
        final x = width - e.width > s.width + _gap ? width - e.width : s.width + _gap;
        ep.offset = Offset(x, (height - e.height) / 2);
      } else {
        sp.offset = Offset.zero;
        ep.offset = Offset(0, s.height + _runGap);
      }
    }
    return constraints.constrain(Size(width, height));
  }

  @override
  void performLayout() => size = _layout(constraints, dry: false);

  @override
  Size computeDryLayout(BoxConstraints constraints) => _layout(constraints, dry: true);

  @override
  double computeMinIntrinsicWidth(double height) {
    final start = firstChild!;
    final end = childAfter(start)!;
    final a = start.getMinIntrinsicWidth(height);
    final b = end.getMinIntrinsicWidth(height);
    return a > b ? a : b;
  }

  @override
  double computeMaxIntrinsicWidth(double height) {
    final start = firstChild!;
    final end = childAfter(start)!;
    return start.getMaxIntrinsicWidth(height) + _gap + end.getMaxIntrinsicWidth(height);
  }

  @override
  double computeMinIntrinsicHeight(double width) => _layout(BoxConstraints(maxWidth: width), dry: true).height;

  @override
  double computeMaxIntrinsicHeight(double width) => computeMinIntrinsicHeight(width);

  @override
  void paint(PaintingContext context, Offset offset) => defaultPaint(context, offset);

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) =>
      defaultHitTestChildren(result, position: position);
}
