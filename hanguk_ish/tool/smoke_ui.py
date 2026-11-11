#!/usr/bin/env python3
"""Reads, taps and types on the emulator, by what the screen says.

  smoke_ui.py wait TEXT [seconds]         until something on screen holds TEXT
  smoke_ui.py gone TEXT [seconds]         until nothing on screen holds TEXT
  smoke_ui.py tap TEXT [seconds] [n]      waits for it, then taps its middle
  smoke_ui.py tapto TEXT NEXT [seconds]   taps TEXT until NEXT shows
  smoke_ui.py tapif TEXT [seconds]        taps it if it comes (a system dialog)
  smoke_ui.py tapbelow ANCHOR TEXT        taps the first TEXT under ANCHOR
  smoke_ui.py scrollto TEXT [swipes]      swipes up until TEXT is on screen
  smoke_ui.py field N VALUE [seconds]     taps the Nth text field, types VALUE
                                          and closes the keyboard
  smoke_ui.py type VALUE                  types into the focused field
  smoke_ui.py hidekb                      closes the keyboard if it is open
  smoke_ui.py focus                       prints the window in front
  smoke_ui.py dump                        prints every text on screen

TEXT matches anywhere in a node's words; «=TEXT» must be all of them. With
several matches, n picks one from the top of the screen (0) or the bottom
(-1). N counts text fields the same way.

Flutter hands its semantics to Android's accessibility tree, which
`uiautomator dump` writes out: a node's words are in `text` or
`content-desc`; text fields are android.widget.EditText. When something is
not found, the last dump is kept in build/smoke/ (published with the
screenshots) to see what the tree held.
"""
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET


def adb(*args, timeout=60):
    return subprocess.run(['adb', *args], capture_output=True, text=True, timeout=timeout).stdout


_size = None
_last_xml = ''


def display():
    """Width and height of the screen in pixels."""
    global _size
    if _size is None:
        found = re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size'))
        _size = tuple(map(int, found[-1])) if found else (1080, 2400)
    return _size


def dump():
    """The nodes of one `uiautomator dump`, scrolled-out ones left out."""
    global _last_xml
    width, height = display()
    # The old file goes first: a dump that fails must not hand back the last screen.
    adb('shell', 'rm -f /sdcard/ui.xml; uiautomator dump --compressed /sdcard/ui.xml')
    xml = adb('shell', 'cat', '/sdcard/ui.xml', timeout=30)
    _last_xml = xml
    start = xml.find('<?xml')
    if start < 0:
        return []
    try:
        root = ET.fromstring(xml[start:].strip())
    except ET.ParseError as e:
        print(f'(the dump does not parse: {e})', file=sys.stderr)
        return []
    nodes = []
    for node in root.iter('node'):
        words = ' '.join(w for w in (node.get('text', ''), node.get('content-desc', '')) if w)
        bounds = re.findall(r'\d+', node.get('bounds', ''))
        if len(bounds) != 4:
            continue
        x1, y1, x2, y2 = map(int, bounds)
        if x2 <= x1 or y2 <= y1 or not (0 <= (x1 + x2) // 2 < width and 0 <= (y1 + y2) // 2 < height):
            continue
        nodes.append({'words': words, 'x': (x1 + x2) // 2, 'y': (y1 + y2) // 2,
                      'field': node.get('class') == 'android.widget.EditText'})
    return nodes


def screen():
    """What is on the screen now. A dump with no words at all is taken again
    once: Flutter builds its semantics only when an accessibility client
    (here: the dump) asks, and can be a frame late."""
    nodes = dump()
    if not any(n['words'] for n in nodes):
        time.sleep(1)
        nodes = dump()
    return nodes


def matches(node, text):
    if text.startswith('='):
        return node['words'] == text[1:]
    return text in node['words']


def show(nodes):
    for n in nodes:
        if n['words']:
            print(f"  {n['words']!r} @ {n['x']},{n['y']}{' [field]' if n['field'] else ''}")


def give_up(message, nodes):
    """Says what was looked for and what was there, keeps the dump, fails."""
    print(message)
    show(nodes)
    os.makedirs('build/smoke', exist_ok=True)
    path = f'build/smoke/screen-{int(time.time())}.xml'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(_last_xml or '(the dump was empty)\n')
    print(f'  (keyboard {"open" if keyboard_open() else "closed"}; the last dump: {path})')
    sys.exit(1)


def find(text, seconds, pick=0, quiet=False):
    deadline = time.time() + seconds
    last = []
    while True:
        last = screen()
        found = sorted((n for n in last if matches(n, text)), key=lambda n: (n['y'], n['x']))
        if found and -len(found) <= pick < len(found):
            return found[pick]
        if time.time() >= deadline:
            break
        time.sleep(1)
    if not quiet:
        give_up(f'NOT ON SCREEN: {text!r}. On screen:', last)
    return None


def find_steady(text, seconds, pick=0):
    """Like find, but the node must be where it was in the dump before: a page
    still sliding or zooming in moves it under the tap."""
    node = find(text, seconds, pick)
    for _ in range(5):
        again = find(text, 5, pick)
        if (again['x'], again['y']) == (node['x'], node['y']):
            return again
        node = again
    return node


def tap_at(x, y):
    adb('shell', 'input', 'tap', str(x), str(y))


def tap_to(text, after, seconds):
    """Taps TEXT until AFTER shows. A tap can be lost: right after an install
    Android may still be finishing the package and restarts the activity, and
    a touch that lands while its window is being replaced goes nowhere. So
    while TEXT is still there and AFTER is not, it taps again (every 8 s, at
    most 3 times)."""
    deadline = time.time() + seconds
    taps, last_tap, last = 0, 0.0, []
    while time.time() < deadline:
        last = screen()
        if any(matches(n, after) for n in last):
            print(f'on screen: {after!r} (after {taps} tap{"" if taps == 1 else "s"})')
            return
        node = next(iter(sorted((n for n in last if matches(n, text)), key=lambda n: (n['y'], n['x']))), None)
        if node and taps < 3 and (taps == 0 or time.time() - last_tap >= 8):
            tap_at(node['x'], node['y'])
            taps, last_tap = taps + 1, time.time()
            print(f"tapped {node['words']!r} @ {node['x']},{node['y']}")
        time.sleep(1)
    give_up(f'NOT ON SCREEN: {after!r} after tapping {text!r} {taps} times. On screen:', last)


def type_text(value):
    # `input text` takes %s for a space.
    adb('shell', 'input', 'text', value.replace(' ', '%s'))


def keyboard_open():
    return 'mInputShown=true' in adb('shell', 'dumpsys', 'input_method')


def hide_keyboard():
    """Closes the soft keyboard with Back, sent only while the keyboard is up:
    then the keyboard takes it and the screen stays. (Not Escape: Gboard lets
    it through, and Flutter closes the open dialog or sheet on Escape.)"""
    for _ in range(2):
        if not keyboard_open():
            return True
        adb('shell', 'input', 'keyevent', '4')
        time.sleep(0.8)
    return not keyboard_open()


def main():
    command, args = sys.argv[1], sys.argv[2:]
    if command == 'dump':
        show(screen())
    elif command == 'focus':
        out = adb('shell', 'dumpsys', 'window')
        focus = [line.strip() for line in out.splitlines() if 'mCurrentFocus' in line or 'mFocusedApp' in line]
        print('\n'.join(focus))
    elif command == 'hidekb':
        print('keyboard closed' if hide_keyboard() else 'keyboard open')
    elif command == 'type':
        type_text(args[0])
        print(f'typed {args[0]!r}')
    elif command == 'field':
        index, value = int(args[0]), args[1]
        seconds = float(args[2]) if len(args) > 2 else 30
        deadline = time.time() + seconds
        hid = False
        while True:
            nodes = screen()
            fields = sorted((n for n in nodes if n['field']), key=lambda n: (n['y'], n['x']))
            if -len(fields) <= index < len(fields):
                break
            if not hid and keyboard_open():
                # The field may be under the keyboard.
                hide_keyboard()
                hid = True
                continue
            if time.time() >= deadline:
                give_up(f'NO TEXT FIELD {index}. On screen:', nodes)
            time.sleep(1)
        target = fields[index]
        tap_at(target['x'], target['y'])
        time.sleep(0.7)
        type_text(value)
        time.sleep(0.5)
        # The keyboard covers half the screen and what is under it; the next
        # step looks for things by what the screen shows.
        closed = hide_keyboard()
        print(f'field {index} @ {target["x"]},{target["y"]}: typed {value!r}'
              f'{"" if closed else " (the keyboard stays open)"}')
    elif command == 'scrollto':
        text = args[0]
        swipes = int(args[1]) if len(args) > 1 else 8
        for _ in range(swipes + 1):
            node = find(text, 0, quiet=True)
            if node:
                print(f'on screen: {node["words"]!r}')
                return
            width, height = display()
            adb('shell', 'input', 'swipe', str(width // 2), str(height * 7 // 10), str(width // 2),
                str(height * 3 // 10), '400')
            time.sleep(1)
        find(text, 3)
    elif command == 'tapbelow':
        # The first TEXT under ANCHOR (a field under its label).
        anchor_text, text = args[0], args[1]
        seconds = float(args[2]) if len(args) > 2 else 30
        anchor = find(anchor_text, seconds)
        nodes = screen()
        below = sorted((n for n in nodes if matches(n, text) and n['y'] > anchor['y']), key=lambda n: n['y'])
        if not below:
            give_up(f'NOTHING {text!r} UNDER {anchor_text!r}. On screen:', nodes)
        tap_at(below[0]['x'], below[0]['y'])
        print(f"tapped {below[0]['words']!r} under {anchor['words']!r}")
    elif command == 'tapto':
        tap_to(args[0], args[1], float(args[2]) if len(args) > 2 else 45)
    elif command == 'tapif':
        text = args[0]
        seconds = float(args[1]) if len(args) > 1 else 5
        node = find(text, seconds, quiet=True)
        if node:
            tap_at(node['x'], node['y'])
            print(f"tapped {node['words']!r} @ {node['x']},{node['y']}")
        else:
            print(f'not asked: {text!r}')
    elif command == 'gone':
        text = args[0]
        seconds = float(args[1]) if len(args) > 1 else 30
        deadline = time.time() + seconds
        nodes = []
        while time.time() < deadline:
            nodes = screen()
            if not any(matches(n, text) for n in nodes):
                print(f'gone: {text!r}')
                return
            time.sleep(1)
        give_up(f'STILL ON SCREEN: {text!r}', nodes)
    else:
        text = args[0]
        seconds = float(args[1]) if len(args) > 1 else 30
        pick = int(args[2]) if len(args) > 2 else 0
        if command == 'tap':
            node = find_steady(text, seconds, pick)
            tap_at(node['x'], node['y'])
            print(f"tapped {node['words']!r} @ {node['x']},{node['y']}")
        else:
            node = find(text, seconds, pick)
            print(f"on screen: {node['words']!r}")


if __name__ == '__main__':
    main()
