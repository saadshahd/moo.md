# Read each snap's chrome: the status line's context use and output style, the spinner (verb and
# the words after its counter), a notice above the prompt box, the prompt's
# text or dim suggestion, the mode row's grey words, hunch's band, and whether
# a dialog is open. Usage: snaps.py <snaps dir> → JSON lines on stdout.
import os, re, sys, json
ESC = re.compile(r'\x1b\[([0-9;]*)m')
def strip(s): return re.sub(r'\x1b\[[0-9;?]*[a-zA-Z]', '', s)
def second(path): return int(os.path.basename(path).split('-')[1].split('.')[0])
def listing(d):
    """The snaps in d in the order the screen drew them. The loop that takes
    them (snap.sh) names each <count>-<second>.ansi, so one loop's names sort
    in order. Two loops left running on one session write one folder: their
    counts repeat or their seconds go back, and only each file's write time
    orders them, which a copy of the folder has lost."""
    names = sorted(f for f in os.listdir(d) if f.endswith('.ansi'))
    paths = [os.path.join(d, f) for f in names]
    counts = [f.split('-')[0] for f in names]
    if len(set(counts)) == len(counts) and all(second(a) <= second(b) for a, b in zip(paths, paths[1:])):
        return paths
    lost = [f for f, p in zip(names, paths) if not second(p) <= os.stat(p).st_mtime < second(p) + 1]
    if lost:
        raise SystemExit(f'{d}: two loops took its snaps, and {len(lost)} lost the time they were written, {lost[0]} first: their order is unknown')
    return sorted(paths, key=lambda p: os.stat(p).st_mtime_ns)
def parse(path):
    raw = open(path, encoding='utf-8').read().split('\n')
    rows = [strip(r).rstrip() for r in raw]
    out = {'t': second(path), 'file': os.path.basename(path)}
    # The terminal's width: the recorder resized it to capture dialogs at 45, 80 and 120.
    out['cols'] = max((len(r) for r in rows if r and set(r) == {'─'}), default=0)
    rules = [i for i, r in enumerate(rows) if r.startswith('────') and set(r) == {'─'}]
    ctx = next((r for r in rows if '◔ Context' in r), None)
    if ctx:
        m = re.search(r'◔ Context (\d+%(?: · [\d.]+k)?)', ctx)
        out['context'] = m.group(1)
        # The output style ends the status line, which wraps onto the rows
        # under it; a line cut short with "…" hides whether it had one.
        k = rows.index(ctx)
        style = next((m.group(1) for r in rows[k:k + 3] for m in [re.search(r'◎ (\S+)', r)] if m), None)
        if style: out['style'] = style
        elif ctx.endswith('…'): out['cut'] = True
    mode = next((r for r in rows if '⏵⏵' in r), None)
    if mode: out['mode'] = mode.split('bypass permissions on', 1)[1].strip()
    spin = [r for r in rows if re.match(r'^[·✢✳✶✻✽*] \S+… ', r + ' ')]
    if spin:
        m = re.match(r'^. (\S+)… ?(?:\((.*)\))?', spin[-1])
        if m:
            tail = m.group(2)
            if tail: tail = re.sub(r'^(\d+m )?\d+s(?: · )?', '', tail)
            out['spin'] = {'verb': m.group(1), 'tail': tail}
    if len(rules) >= 2 and ctx:
        top = rules[-2]
        above = rows[top - 1] if top else ''
        # A notice sits right above the prompt box, unless the slash menu does:
        # its rows start with a command, or continue one at column 36.
        menu = re.match(r'^  (❯ |  )/', rows[top - 2] if top > 1 else '') or re.match(r'^  (❯ |  )/', above)
        if above.strip() and above.startswith(' ' * 6) and not menu: out['hint'] = above.strip()
        prompt = raw[top + 1]
        p = strip(prompt)
        if '\x1b[2m' in prompt: out['suggestion'] = p[2:].strip()
        else: out['prompt'] = p[2:].rstrip()
        band = [r for r in rows[:top] if r.startswith('[ ') and r.rstrip().endswith(' ]')]
        if band: out['band'] = re.findall(r'\[ (.*?) \]', band[-1])
    out['dialog'] = any(r.startswith('Enter to select') for r in rows)
    return out
if __name__ == '__main__':
    for p in listing(sys.argv[1]): print(json.dumps(parse(p), ensure_ascii=False))
