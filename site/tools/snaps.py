# Read each snap's chrome: the status line's context use, the spinner (verb and
# the words after its counter), a notice above the prompt box, the prompt's
# text or dim suggestion, the mode row's grey words, hunch's band, and whether
# a dialog is open. Usage: snaps.py <snaps dir> → JSON lines on stdout.
import os, re, sys, json
ESC = re.compile(r'\x1b\[([0-9;]*)m')
def strip(s): return re.sub(r'\x1b\[[0-9;?]*[a-zA-Z]', '', s)
def parse(path):
    raw = open(path, encoding='utf-8').read().split('\n')
    rows = [strip(r).rstrip() for r in raw]
    t = int(os.path.basename(path).split('-')[1].split('.')[0])
    out = {'t': t, 'file': os.path.basename(path)}
    # The terminal's width: the recorder resized it to capture dialogs at 45, 80 and 120.
    out['cols'] = max((len(r) for r in rows if r and set(r) == {'─'}), default=0)
    rules = [i for i, r in enumerate(rows) if r.startswith('────') and set(r) == {'─'}]
    ctx = next((r for r in rows if '◔ Context' in r), None)
    if ctx:
        m = re.search(r'◔ Context (\d+%(?: · [\d.]+k)?)', ctx)
        out['context'] = m.group(1)
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
    d = sys.argv[1]
    for f in sorted(os.listdir(d)):
        if f.endswith('.ansi'): print(json.dumps(parse(os.path.join(d, f)), ensure_ascii=False))
