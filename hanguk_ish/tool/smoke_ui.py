#!/usr/bin/env python3
"""Reads and taps what an app shows on the emulator, by its text.

  smoke_ui.py wait <text> [seconds]          until something on screen holds <text>
  smoke_ui.py tap <text> [seconds]           waits for it, then taps its middle
  smoke_ui.py tapto <text> <next> [seconds]  taps <text> until <next> shows
  smoke_ui.py dump                           prints every text on screen

Flutter hands its semantics to Android's accessibility tree, which
`uiautomator dump` writes out: a node's words are in `text` or
`content-desc`. When something is not found, the last dump is kept in
build/smoke/ (published with the screenshots) to see what the tree held.
"""
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

_last_xml = ''


def screen():
    global _last_xml
    # The old file goes first: a dump that fails must not hand back the last screen.
    subprocess.run(['adb', 'shell', 'rm -f /sdcard/ui.xml; uiautomator dump --compressed /sdcard/ui.xml'],
                   capture_output=True, text=True, timeout=60)
    xml = subprocess.run(['adb', 'shell', 'cat', '/sdcard/ui.xml'],
                         capture_output=True, text=True, timeout=30).stdout
    _last_xml = xml
    start = xml.find('<?xml')
    if start < 0:
        return []
    try:
        root = ET.fromstring(xml[start:].strip())
    except ET.ParseError:
        return []
    nodes = []
    for node in root.iter('node'):
        words = ' '.join(w for w in (node.get('text', ''), node.get('content-desc', '')) if w)
        bounds = re.findall(r'\d+', node.get('bounds', ''))
        if words and len(bounds) == 4:
            x1, y1, x2, y2 = map(int, bounds)
            nodes.append((words, (x1 + x2) // 2, (y1 + y2) // 2))
    return nodes


def give_up(message, last):
    print(message)
    for words, _, _ in last:
        print(f'  {words!r}')
    os.makedirs('build/smoke', exist_ok=True)
    path = f'build/smoke/screen-{int(time.time())}.xml'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(_last_xml or '(the dump was empty)\n')
    print(f'  (the last dump: {path})')
    sys.exit(1)


def find(text, seconds):
    deadline = time.time() + seconds
    last = []
    while time.time() < deadline:
        last = screen()
        for node in last:
            if text in node[0]:
                return node
        time.sleep(1)
    give_up(f'NOT ON SCREEN: {text!r}. On screen:', last)


def tap(x, y):
    subprocess.run(['adb', 'shell', 'input', 'tap', str(x), str(y)], check=True, timeout=30)


def tap_to(text, after, seconds):
    """Taps <text> until <after> shows. A tap can be lost: right after an
    install Android may still be finishing the package and restarts the
    activity, and a touch that lands while its window is being replaced goes
    nowhere. So while <text> is still there and <after> is not, it taps again
    (every 8 s, at most 3 times)."""
    deadline = time.time() + seconds
    taps, last_tap, last = 0, 0.0, []
    while time.time() < deadline:
        last = screen()
        if any(after in words for words, _, _ in last):
            print(f'on screen: {after!r} (after {taps} tap{"s" if taps != 1 else ""})')
            return
        node = next((n for n in last if text in n[0]), None)
        if node and taps < 3 and (taps == 0 or time.time() - last_tap >= 8):
            tap(node[1], node[2])
            taps, last_tap = taps + 1, time.time()
            print(f'tapped {node[0]!r} @ {node[1]},{node[2]}')
        time.sleep(1)
    give_up(f'NOT ON SCREEN: {after!r} after tapping {text!r} {taps} times. On screen:', last)


def main():
    command = sys.argv[1]
    if command == 'dump':
        for words, x, y in screen():
            print(f'{words!r} @ {x},{y}')
        return
    if command == 'tapto':
        tap_to(sys.argv[2], sys.argv[3], float(sys.argv[4]) if len(sys.argv) > 4 else 45)
        return
    text = sys.argv[2]
    seconds = float(sys.argv[3]) if len(sys.argv) > 3 else 30
    words, x, y = find(text, seconds)
    if command == 'tap':
        tap(x, y)
        print(f'tapped {words!r} @ {x},{y}')
    else:
        print(f'on screen: {words!r}')


if __name__ == '__main__':
    main()
