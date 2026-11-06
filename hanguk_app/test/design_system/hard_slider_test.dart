import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/seoul_night/widgets/hard_slider.dart';

void main() {
  testWidgets('a drag reports its moves and ends once; a tap ends once', (t) async {
    var value = 0.2;
    var moves = 0;
    var ends = 0;
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 300,
              child: StatefulBuilder(
                builder: (context, setState) => HardSlider(
                  value: value,
                  semanticLabel: 'GPA',
                  onChanged: (v) => setState(() {
                    value = v;
                    moves++;
                  }),
                  onChangeEnd: () => ends++,
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await t.drag(find.byType(HardSlider), const Offset(120, 0));
    await t.pump();
    expect(moves, greaterThanOrEqualTo(1));
    expect(ends, 1);
    expect(value, greaterThan(0.2));

    await t.tapAt(t.getCenter(find.byType(HardSlider)));
    await t.pump();
    expect(ends, 2);
  });

  testWidgets('without onChangeEnd it behaves as before', (t) async {
    var value = 0.5;
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 300,
              child: StatefulBuilder(
                builder: (context, setState) => HardSlider(
                  value: value,
                  semanticLabel: 'GPA',
                  onChanged: (v) => setState(() => value = v),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await t.tapAt(t.getTopLeft(find.byType(HardSlider)) + const Offset(30, 14));
    await t.pump();
    expect(value, lessThan(0.5));
  });
}
