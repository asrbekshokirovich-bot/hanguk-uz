#!/usr/bin/env python3
"""Reads, taps and types on the emulator, by what the screen says.

  smoke_ui.py wait TEXT [seconds]         until something on screen holds TEXT
  smoke_ui.py gone TEXT [seconds]         until nothing on screen holds TEXT
  smoke_ui.py tap TEXT [seconds] [n]      waits for it, then taps its middle
  smoke_ui.py tapif TEXT [seconds]        taps it if it comes (a system dialog)
  smoke_ui.py tapto TEXT NEXT [seconds]   taps TEXT until NEXT shows (a lost tap again)
  smoke_ui.py tapbelow ANCHOR TEXT        taps the first TEXT under ANCHOR
  smoke_ui.py tapend TEXT DP              taps DP above the bottom edge of TEXT's
                                          node, swiping until that edge is on screen
  smoke_ui.py tapx TEXT DP                taps DP left of the screen's right edge,
                                          level with TEXT's node
  smoke_ui.py scrollto TEXT [swipes]      swipes up until TEXT is on screen
  smoke_ui.py field N VALUE [seconds]     taps the Nth text field, types VALUE
  smoke_ui.py type VALUE                  types into the focused field
  smoke_ui.py hidekb                      closes the keyboard if it is open
  smoke_ui.py focus                       prints the window in front
  smoke_ui.py dump                        prints every text on screen

TEXT matches anywhere in a node's words; «=TEXT» must be all of them. With
several matches, n picks one from the top of the screen (0) or the bottom
(-1). N counts text fields the same way.

Flutter hands its semantics to Android's accessibility tree, which
`uiautomator dump` writes out: a node's words are in `text` or
`content-desc`; text fields are android.widget.EditText.
"""
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET


def adb(*args, timeout=60):
    return subprocess.run(['adb', *args], capture_output=True, text=True, timeout=timeout).stdout


_size = None
_density = None


def display():
    """Width and height of the screen in pixels."""
    global _size
    if _size is None:
        found = re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size'))
        _size = tuple(map(int, found[-1])) if found else (1080, 2400)
    return _size


def density():
    """Pixels per dp."""
    global _density
    if _density is None:
        found = re.findall(r'(\d+)', adb('shell', 'wm', 'density'))
        _density = int(found[-1]) / 160 if found else 2.625
    return _density


def swipe_up():
    width, height = display()
    adb('shell', 'input', 'swipe', str(width // 2), str(height * 7 // 10), str(width // 2),
        str(height * 3 // 10), '400')
    time.sleep(1)


def screen():
    """What is on the screen now (nodes scrolled out of sight left out)."""
    width, height = display()
    adb('shell', 'uiautomator', 'dump', '--compressed', '/sdcard/ui.xml')
    xml = adb('shell', 'cat', '/sdcard/ui.xml', timeout=30)
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
        if len(bounds) != 4:
            continue
        x1, y1, x2, y2 = map(int, bounds)
        if x2 <= x1 or y2 <= y1 or not (0 <= (x1 + x2) // 2 < width and 0 <= (y1 + y2) // 2 < height):
            continue
        nodes.append({'words': words, 'x': (x1 + x2) // 2, 'y': (y1 + y2) // 2, 'bottom': y2,
                      'field': node.get('class') == 'android.widget.EditText'})
    return nodes


def wave_off_foreign_anr(nodes):
    """The emulator's own apps (Pixel Launcher) sometimes stop answering under
    load, and their «… isn't responding» box covers ours for the whole run.
    Theirs is waved off («Wait»); ours (Hanguk Ish) is a failure and stays."""
    title = next((n for n in nodes if re.search(r"isn.t responding", n['words'])), None)
    if title is None or 'Hanguk Ish' in title['words']:
        return False
    wait = next((n for n in nodes if n['words'] == 'Wait'), None)
    if wait is None:
        return False
    print(f"waved off: {title['words']!r}")
    tap_at(wait['x'], wait['y'])
    time.sleep(1)
    return True


def matches(node, text):
    if text.startswith('='):
        return node['words'] == text[1:]
    return text in node['words']


def show(nodes):
    for n in nodes:
        if n['words']:
            print(f"  {n['words']!r} @ {n['x']},{n['y']}{' [field]' if n['field'] else ''}")


def find(text, seconds, pick=0, quiet=False):
    deadline = time.time() + seconds
    last = []
    while True:
        last = screen()
        if wave_off_foreign_anr(last):
            continue
        found = sorted((n for n in last if matches(n, text)), key=lambda n: (n['y'], n['x']))
        if found and -len(found) <= pick < len(found):
            return found[pick]
        if time.time() >= deadline:
            break
        time.sleep(1)
    if not quiet:
        print(f'NOT ON SCREEN: {text!r}. On screen:')
        show(last)
        sys.exit(1)
    return None


def tap_at(x, y):
    adb('shell', 'input', 'tap', str(x), str(y))


def type_text(value):
    # `input text` takes %s for a space.
    adb('shell', 'input', 'text', value.replace(' ', '%s'))


def keyboard_open():
    return 'mInputShown=true' in adb('shell', 'dumpsys', 'input_method')


def main():
    command, args = sys.argv[1], sys.argv[2:]
    if command == 'dump':
        show(screen())
    elif command == 'focus':
        out = adb('shell', 'dumpsys', 'window')
        focus = [line.strip() for line in out.splitlines() if 'mCurrentFocus' in line or 'mFocusedApp' in line]
        print('\n'.join(focus))
    elif command == 'hidekb':
        # Escape closes the keyboard and nothing else (Back could leave the screen).
        if keyboard_open():
            adb('shell', 'input', 'keyevent', '111')
            time.sleep(0.7)
        print('keyboard open' if keyboard_open() else 'keyboard closed')
    elif command == 'type':
        type_text(args[0])
        print(f'typed {args[0]!r}')
    elif command == 'field':
        index, value = int(args[0]), args[1]
        seconds = float(args[2]) if len(args) > 2 else 30
        deadline = time.time() + seconds
        while True:
            nodes = screen()
            if wave_off_foreign_anr(nodes):
                continue
            fields = sorted((n for n in nodes if n['field']), key=lambda n: (n['y'], n['x']))
            if -len(fields) <= index < len(fields):
                break
            if time.time() >= deadline:
                print(f'NO TEXT FIELD {index}. On screen:')
                show(screen())
                sys.exit(1)
            time.sleep(1)
        target = fields[index]
        tap_at(target['x'], target['y'])
        time.sleep(0.7)
        type_text(value)
        time.sleep(0.5)
        print(f'field {index} @ {target["x"]},{target["y"]}: typed {value!r}')
    elif command == 'scrollto':
        text = args[0]
        swipes = int(args[1]) if len(args) > 1 else 8
        for _ in range(swipes + 1):
            node = find(text, 0, quiet=True)
            if node:
                print(f'on screen: {node["words"]!r}')
                return
            swipe_up()
        find(text, 3)
    elif command == 'tapend':
        # A button whose words Flutter merged into its card's node (BA3's QR
        # card): the card's middle is not the button, its bottom edge is.
        text, dp = args[0], float(args[1])
        _, height = display()
        node = find(text, 30)
        for _ in range(4):
            # Clear of the gesture bar: the edge is the card's, not the screen's.
            if node['bottom'] < height - 60 * density():
                break
            swipe_up()
            moved = find(text, 5)
            if moved['bottom'] == node['bottom']:
                break
            node = moved
        y = int(node['bottom'] - dp * density())
        tap_at(node['x'], y)
        print(f"tapped {dp:g} dp above the bottom of {node['words']!r} @ {node['x']},{y}")
    elif command == 'tapx':
        # A button at the end of a row whose words Flutter merged into the
        # row's node (BA5's «CSV 다운로드» beside the title).
        text, dp = args[0], float(args[1])
        width, _ = display()
        node = find(text, 30)
        x = int(width - dp * density())
        tap_at(x, node['y'])
        print(f"tapped {dp:g} dp from the right, level with {node['words']!r} @ {x},{node['y']}")
    elif command == 'tapbelow':
        # The first TEXT under ANCHOR (a field under its label).
        anchor_text, text = args[0], args[1]
        seconds = float(args[2]) if len(args) > 2 else 30
        anchor = find(anchor_text, seconds)
        below = sorted((n for n in screen() if matches(n, text) and n['y'] > anchor['y']), key=lambda n: n['y'])
        if not below:
            print(f'NOTHING {text!r} UNDER {anchor_text!r}. On screen:')
            show(screen())
            sys.exit(1)
        tap_at(below[0]['x'], below[0]['y'])
        print(f"tapped {below[0]['words']!r} under {anchor['words']!r}")
    elif command == 'tapto':
        # Taps TEXT until NEXT shows (P31): a tap can be lost — right after an
        # install Android may still be finishing the package and restart the
        # activity, and a touch that lands while its window is replaced goes
        # nowhere. While TEXT is still there and NEXT is not, it taps again
        # (every 8 s, at most 3 times).
        text, after = args[0], args[1]
        seconds = float(args[2]) if len(args) > 2 else 40
        deadline = time.time() + seconds
        taps, last_tap, last = 0, 0.0, []
        while time.time() < deadline:
            last = screen()
            if wave_off_foreign_anr(last):
                continue
            if any(matches(n, after) for n in last):
                print(f"on screen: {after!r} (after {taps} tap{'s' if taps != 1 else ''})")
                return
            node = next((n for n in last if matches(n, text)), None)
            if node and taps < 3 and (taps == 0 or time.time() - last_tap >= 8):
                tap_at(node['x'], node['y'])
                taps, last_tap = taps + 1, time.time()
                print(f"tapped {node['words']!r} @ {node['x']},{node['y']}")
            time.sleep(1)
        print(f'NOT ON SCREEN: {after!r} after tapping {text!r} {taps} times. On screen:')
        show(last)
        sys.exit(1)
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
        while time.time() < deadline:
            if not any(matches(n, text) for n in screen()):
                print(f'gone: {text!r}')
                return
            time.sleep(1)
        print(f'STILL ON SCREEN: {text!r}')
        sys.exit(1)
    else:
        text = args[0]
        seconds = float(args[1]) if len(args) > 1 else 30
        pick = int(args[2]) if len(args) > 2 else 0
        node = find(text, seconds, pick)
        if command == 'tap':
            tap_at(node['x'], node['y'])
            print(f"tapped {node['words']!r} @ {node['x']},{node['y']}")
        else:
            print(f"on screen: {node['words']!r}")


if __name__ == '__main__':
    main()
