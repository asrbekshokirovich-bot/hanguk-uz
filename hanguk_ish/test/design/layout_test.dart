import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/design/widgets/layout.dart';

Widget _row(double width, double start, double end, {double allowance = 4}) => Directionality(
      textDirection: TextDirection.ltr,
      child: Align(
        alignment: Alignment.topLeft,
        child: SizedBox(
          width: width,
          child: HiSplitRow(
            overflowAllowance: allowance,
            start: SizedBox(key: const Key('start'), width: start, height: 32),
            end: SizedBox(key: const Key('end'), width: end, height: 28),
          ),
        ),
      ),
    );

void main() {
  testWidgets('the second item goes to the end of the line (margin-left:auto)', (tester) async {
    await tester.pumpWidget(_row(316, 177.5, 121));
    expect(tester.getTopLeft(find.byKey(const Key('start'))), const Offset(0, 0));
    expect(tester.getTopLeft(find.byKey(const Key('end'))), const Offset(316 - 121, 2));
    expect(tester.getSize(find.byType(HiSplitRow)), const Size(316, 32));
  });

  testWidgets('a little too wide: stays on the line, right after the first one', (tester) async {
    // The prototype's second A06 card: 164.27 + 8 + 152.69 = 324.96 > 316.
    await tester.pumpWidget(_row(316, 164.27, 152.69, allowance: 12));
    expect(tester.getTopLeft(find.byKey(const Key('end'))).dx, closeTo(172.27, 1e-6));
    expect(tester.getSize(find.byType(HiSplitRow)).height, 32);
  });

  testWidgets('much too wide: the second item moves to its own line', (tester) async {
    await tester.pumpWidget(_row(316, 190, 150, allowance: 12));
    expect(tester.getTopLeft(find.byKey(const Key('end'))), const Offset(0, 40));
    expect(tester.getSize(find.byType(HiSplitRow)).height, 32 + 8 + 28);
  });

  // Inside IntrinsicHeight / IntrinsicWidth (a row that sizes to its
  // children) the row measures what it then lays out.
  Widget measured(Widget child) => Directionality(
        textDirection: TextDirection.ltr,
        child: Align(alignment: Alignment.topLeft, child: child),
      );
  HiSplitRow split(double start, double end, {double allowance = 4, double gap = 8, double runGap = 8}) => HiSplitRow(
        overflowAllowance: allowance,
        gap: gap,
        runGap: runGap,
        start: SizedBox(key: const Key('start'), width: start, height: 32),
        end: SizedBox(key: const Key('end'), width: end, height: 28),
      );

  testWidgets('IntrinsicHeight: one line or two, as laid out', (tester) async {
    await tester.pumpWidget(measured(SizedBox(width: 316, child: IntrinsicHeight(child: split(177.5, 121)))));
    expect(tester.getSize(find.byType(HiSplitRow)), const Size(316, 32));
    await tester.pumpWidget(measured(SizedBox(width: 316, child: IntrinsicHeight(child: split(190, 150, allowance: 12)))));
    expect(tester.getSize(find.byType(HiSplitRow)), const Size(316, 32 + 8 + 28));
    expect(tester.getTopLeft(find.byKey(const Key('end'))), const Offset(0, 40));
  });

  testWidgets('IntrinsicWidth: both items and the gap on one line', (tester) async {
    await tester.pumpWidget(measured(IntrinsicWidth(child: split(100, 60))));
    expect(tester.getSize(find.byType(HiSplitRow)), const Size(168, 32));
    expect(tester.getTopLeft(find.byKey(const Key('end'))), const Offset(108, 2));
  });

  testWidgets('a new gap, run gap or allowance lays it out again', (tester) async {
    await tester.pumpWidget(_row(316, 164.27, 152.69, allowance: 12));
    expect(tester.getTopLeft(find.byKey(const Key('end'))).dy, 2);
    // A wider gap no longer fits: the second item goes down, runGap under it.
    await tester.pumpWidget(measured(SizedBox(width: 316, child: split(164.27, 152.69, allowance: 12, gap: 30, runGap: 4))));
    expect(tester.getTopLeft(find.byKey(const Key('end'))), const Offset(0, 36));
    // More allowance: back on the line, right after the gap.
    await tester.pumpWidget(measured(SizedBox(width: 316, child: split(164.27, 152.69, allowance: 40, gap: 30, runGap: 4))));
    expect(tester.getTopLeft(find.byKey(const Key('end'))).dx, closeTo(194.27, 1e-6));
  });
}
