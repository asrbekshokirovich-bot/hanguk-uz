import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class AdaptiveScaffold extends StatelessWidget {
  final Widget? title;
  final Widget body;
  final Widget? bottomNavigationBar;

  const AdaptiveScaffold({
    super.key,
    this.title,
    required this.body,
    this.bottomNavigationBar,
  });

  @override
  Widget build(BuildContext context) {
    if (Platform.isIOS) {
      return CupertinoPageScaffold(
        navigationBar: title != null
            ? CupertinoNavigationBar(middle: title)
            : null,
        child: bottomNavigationBar != null
            ? Column(
                children: [
                  Expanded(child: SafeArea(child: body)),
                  bottomNavigationBar!,
                ],
              )
            : SafeArea(child: body),
      );
    }

    return Scaffold(
      appBar: title != null ? AppBar(title: title) : null,
      body: body,
      bottomNavigationBar: bottomNavigationBar,
    );
  }
}
