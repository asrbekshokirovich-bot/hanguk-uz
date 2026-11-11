import 'package:flutter/material.dart';

import '../icons.dart';
import '../insets.dart';
import '../tokens.dart';
import '../typography.dart';
import 'forms.dart';
import 'pressable.dart';

/// One row of a [showHiPicker] list.
class HiPickerOption {
  const HiPickerOption(this.value, this.label);

  final String value;
  final String label;
}

/// A white bottom sheet listing [options], with a search box unless
/// [searchable] is off. Returns the chosen value; when [allowTyped] is set
/// and the search text matches no option, the text itself can be chosen.
Future<String?> showHiPicker(
  BuildContext context, {
  required String title,
  required List<HiPickerOption> options,
  required String searchHint,
  String? selected,
  String Function(String typed)? allowTyped,
  bool searchable = true,
}) {
  return showModalBottomSheet<String>(
    context: context,
    // Above the bottom menu of the tab screens.
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x99040716),
    builder: (context) => _PickerSheet(
      title: title,
      options: options,
      searchHint: searchHint,
      selected: selected,
      allowTyped: allowTyped,
      searchable: searchable,
    ),
  );
}

/// A white bottom sheet with checkable [options] and «apply» / «reset»
/// buttons. Returns the chosen values (empty after reset), or null when the
/// sheet is dismissed.
Future<Set<String>?> showHiMultiPicker(
  BuildContext context, {
  required String title,
  required List<HiPickerOption> options,
  required Set<String> selected,
  required String apply,
  required String reset,
}) {
  return showModalBottomSheet<Set<String>>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x99040716),
    builder: (context) => _MultiPickerSheet(
      title: title,
      options: options,
      selected: selected,
      apply: apply,
      reset: reset,
    ),
  );
}

/// A white bottom sheet with a few actions (icon + label). Returns the index.
Future<int?> showHiActions(
  BuildContext context, {
  required List<(HiIconData, String)> actions,
}) {
  return showModalBottomSheet<int>(
    context: context,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x99040716),
    builder: (context) => _SheetFrame(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < actions.length; i++)
            _SheetRow(
              icon: actions[i].$1,
              label: actions[i].$2,
              onTap: () => Navigator.of(context).pop(i),
            ),
        ],
      ),
    ),
  );
}

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({required this.child, this.maxHeightFactor});

  final Widget child;
  final double? maxHeightFactor;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final content = Container(
      decoration: const BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(HiRadii.card)),
        border: Border.fromBorderSide(HiBorders.ink),
      ),
      padding: EdgeInsets.fromLTRB(18, 10, 18, HiInsets.bottom(context, 30)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 5,
              decoration: BoxDecoration(
                color: HiColors.surface,
                borderRadius: BorderRadius.circular(HiRadii.pill),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Flexible(child: child),
        ],
      ),
    );
    final factor = maxHeightFactor;
    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: factor == null
          ? content
          : ConstrainedBox(
              constraints: BoxConstraints(maxHeight: media.size.height * factor),
              child: content,
            ),
    );
  }
}

class _SheetRow extends StatelessWidget {
  const _SheetRow({this.icon, required this.label, required this.onTap, this.selected = false});

  final HiIconData? icon;
  final String label;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final leading = icon;
    return HiPressable(
      onTap: onTap,
      selected: selected,
      builder: (context, pressed) => Container(
        constraints: const BoxConstraints(minHeight: 52),
        padding: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(
          color: pressed ? HiColors.surface : null,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            if (leading != null) ...[
              HiIcon(leading, size: 20, strokeWidth: 2, color: HiColors.ink),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: HiText(label, style: hiStyle(16, FontWeight.w700, color: HiColors.ink)),
              ),
            ),
            if (selected)
              const HiIcon(HiIcons.check, size: 20, strokeWidth: 3, color: HiColors.blue),
          ],
        ),
      ),
    );
  }
}

class _PickerSheet extends StatefulWidget {
  const _PickerSheet({
    required this.title,
    required this.options,
    required this.searchHint,
    required this.selected,
    required this.allowTyped,
    required this.searchable,
  });

  final String title;
  final List<HiPickerOption> options;
  final String searchHint;
  final String? selected;
  final String Function(String typed)? allowTyped;
  final bool searchable;

  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet> {
  final _query = TextEditingController();

  /// Opens with the chosen option in view (two rows above it), so a long
  /// list (times, dates) does not start from the top.
  late final _scroll = ScrollController(
    initialScrollOffset: () {
      final i = widget.options.indexWhere((o) => o.value == widget.selected);
      return i > 2 ? (i - 2) * _rowHeight : 0.0;
    }(),
  );

  static const _rowHeight = 52.0;

  @override
  void dispose() {
    _query.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final q = _query.text.trim().toLowerCase();
    final shown = q.isEmpty
        ? widget.options
        : widget.options.where((o) => o.label.toLowerCase().contains(q)).toList();
    final typed = _query.text.trim();
    final typedLabel = widget.allowTyped;
    final offerTyped = typedLabel != null &&
        typed.isNotEmpty &&
        !widget.options.any((o) => o.label.toLowerCase() == typed.toLowerCase());
    return _SheetFrame(
      maxHeightFactor: 0.85,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HiText(widget.title, style: hiStyle(18, FontWeight.w800, color: HiColors.ink)),
          const SizedBox(height: 12),
          if (widget.searchable) ...[
            HiInputField(
              controller: _query,
              placeholder: widget.searchHint,
              textInputAction: TextInputAction.search,
              // A typed value is kept as it is (A02 university, district):
              // within what the profile holds.
              maxLength: 80,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),
          ],
          Flexible(
            child: ListView(
              controller: _scroll,
              shrinkWrap: true,
              children: [
                if (offerTyped)
                  _SheetRow(
                    icon: HiIcons.plus,
                    label: typedLabel(typed),
                    onTap: () => Navigator.of(context).pop(typed),
                  ),
                for (final option in shown)
                  _SheetRow(
                    label: option.label,
                    selected: option.value == widget.selected,
                    onTap: () => Navigator.of(context).pop(option.value),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MultiPickerSheet extends StatefulWidget {
  const _MultiPickerSheet({
    required this.title,
    required this.options,
    required this.selected,
    required this.apply,
    required this.reset,
  });

  final String title;
  final List<HiPickerOption> options;
  final Set<String> selected;
  final String apply;
  final String reset;

  @override
  State<_MultiPickerSheet> createState() => _MultiPickerSheetState();
}

class _MultiPickerSheetState extends State<_MultiPickerSheet> {
  late final Set<String> _chosen = {...widget.selected};

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      maxHeightFactor: 0.85,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HiText(widget.title, style: hiStyle(18, FontWeight.w800, color: HiColors.ink)),
          const SizedBox(height: 6),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final option in widget.options)
                  _SheetRow(
                    label: option.label,
                    selected: _chosen.contains(option.value),
                    onTap: () => setState(() {
                      if (!_chosen.remove(option.value)) _chosen.add(option.value);
                    }),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _SheetButton(
                  label: widget.reset,
                  filled: false,
                  onTap: () => Navigator.of(context).pop(<String>{}),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: _SheetButton(
                  label: widget.apply,
                  filled: true,
                  onTap: () => Navigator.of(context).pop(_chosen),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SheetButton extends StatelessWidget {
  const _SheetButton({required this.label, required this.filled, required this.onTap});

  final String label;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      builder: (context, pressed) => Container(
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: filled ? (pressed ? HiColors.blueDeep : HiColors.ink) : (pressed ? HiColors.surface : HiColors.white),
          borderRadius: BorderRadius.circular(HiRadii.button),
          border: Border.fromBorderSide(HiBorders.ink),
        ),
        child: HiText(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: hiStyle(16, FontWeight.w800, color: filled ? HiColors.white : HiColors.ink),
        ),
      ),
    );
  }
}
