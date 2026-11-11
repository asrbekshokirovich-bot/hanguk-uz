#!/usr/bin/env python3
"""Reads and taps what an app shows on the emulator, by its text.

  smoke_ui.py wait <text> [seconds]   until something on screen holds <text>
  smoke_ui.py tap <text> [seconds]    waits for it, then taps its middle
  smoke_ui.py dump                    prints every text on screen

Flutter hands its semantics to Android's accessibility tree, which
`uiautomator dump` writes out: a node's words are in `text` or
`content-desc`.
"""
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET


def screen():
    subprocess.run(['adb', 'shell', 'uiautomator', 'dump', '--compressed', '/sdcard/ui.xml'],
                   capture_output=True, text=True, timeout=60)
    xml = subprocess.run(['adb', 'shell', 'cat', '/sdcard/ui.xml'],
                         capture_output=True, text=True, timeout=30).stdout
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


def find(text, seconds):
    deadline = time.time() + seconds
    last = []
    while time.time() < deadline:
        last = screen()
        for node in last:
            if text in node[0]:
                return node
        time.sleep(1)
    print(f'NOT ON SCREEN: {text!r}. On screen:')
    for words, _, _ in last:
        print(f'  {words!r}')
    sys.exit(1)


def main():
    command = sys.argv[1]
    if command == 'dump':
        for words, x, y in screen():
            print(f'{words!r} @ {x},{y}')
        return
    text = sys.argv[2]
    seconds = float(sys.argv[3]) if len(sys.argv) > 3 else 30
    words, x, y = find(text, seconds)
    if command == 'tap':
        subprocess.run(['adb', 'shell', 'input', 'tap', str(x), str(y)], check=True, timeout=30)
        print(f'tapped {words!r} @ {x},{y}')
    else:
        print(f'on screen: {words!r}')


if __name__ == '__main__':
    main()
