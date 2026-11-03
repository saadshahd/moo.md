# Build a site session module from one recorded Claude Code session.
# Text comes from the session file and tend's store; activity lines from the
# snaps, checked against the session file replayed (replay.mjs); what Claude
# Code drew around the prompt box (status line, spinner, slash menu) and
# tend's toast from the snaps; keys from the recorder's
# key log. The module names no home folder: see renamed().
# Usage: gen.py <session.jsonl> <cwd> <rec dir> <out.ts> [N=tend short key ...]
#   [--keys keylog.json] [--activity-from-snaps] [--raw turns.json] [--comment text]
# --raw writes the turns as recorded, home folder and all, for check-screen.mts,
# and the session file's path beside them (.src), for check-timing.mts.
import json, os, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from snaps import parse as parse_snap, strip

sess, cwd, rec, out = sys.argv[1:5]
opts = sys.argv[5:]
shorts = dict(o.split('=', 1) for o in opts if re.match(r'^\d+=', o))
comment = next((opts[i + 1] for i, o in enumerate(opts) if o == '--comment'), '')
keylog = next((opts[i + 1] for i, o in enumerate(opts) if o == '--keys'), None)
raw_out = next((opts[i + 1] for i, o in enumerate(opts) if o == '--raw'), None)
events = json.load(open(keylog))['events'] if keylog else []

recs = [json.loads(l) for l in open(sess)]
ts = lambda e: __import__('datetime').datetime.fromisoformat(e['timestamp'].replace('Z', '+00:00')).timestamp()
is_prompt = lambda e: e.get('type') == 'user' and isinstance(e['message']['content'], str) and not e.get('isMeta')
starts = [i for i, e in enumerate(recs) if is_prompt(e)]

def shown_prompt(text):
    name = re.search(r'<command-name>(.*?)</command-name>', text, re.S)
    args = re.search(r'<command-args>(.*?)</command-args>', text, re.S)
    return f"{name.group(1)} {args.group(1) if args else ''}".strip() if name else text

import glob
store_p = os.path.join(rec, 'tend-store.json')
store = json.load(open(store_p if os.path.exists(store_p) else glob.glob(os.path.expanduser('~/.claude/plugins/store/hunch_moo_md-*.json'))[0]))
sid = os.path.basename(sess).split('.')[0]
short = store.get(f'tend:{sid}:short', {}) or {}

snaps = [parse_snap(os.path.join(rec, 'snaps', f)) | {'raw': open(os.path.join(rec, 'snaps', f), encoding='utf-8').read()}
         for f in sorted(os.listdir(os.path.join(rec, 'snaps'))) if f.endswith('.ansi')]

def chrome_of(s):
    # The mode row, the notice above the prompt box, the dim suggestion in it,
    # the hook the spinner names and hunch's band are left out of the demos,
    # as the user asked; the spinner keeps its verb and counter.
    c = {'context': s['context'], **({'style': s['style']} if s.get('style') else {})}
    if s.get('spin'):
        tail = ' · '.join(x for x in (s['spin'].get('tail') or '').split(' · ')
                          if x and not re.match(r'^running .* hook$|^(\d+m )?\d+s$', x))
        c['spin'] = {'verb': s['spin']['verb'], **({'tail': tail} if tail else {})}
    return c

def toast_of(raw):
    rows = [strip(r) for r in raw.split('\n')]
    for i, r in enumerate(rows):
        if re.search(r'│ hunch +│', r):
            text = []
            for x in rows[i + 1:]:
                m = re.search(r'│ (.*?) *│\s*$', x)
                if not m or '╰' in x: break
                text.append(m.group(1).strip())
            return ' '.join(text)
    return None

# The collapsed tool summary under each prompt, as the tall capture drew it.
# The recorder's tall3 captures replace tall where both exist: the old ones
# came from a session resumed in another permission mode.
tall_p = next(p for p in (os.path.join(rec, 'tall3-120.ansi'), os.path.join(rec, 'tall-120.ansi')) if os.path.exists(p))
tall = [strip(r).rstrip() for r in open(tall_p, encoding='utf-8').read().split('\n')]
# A task notification draws no prompt: its summary follows the done line
# ("✻ Brewed for 1m 5s · …") of the turn before.
summaries, notices = [], []
for i, r in enumerate(tall):
    notice = r.startswith('✻ ')
    if (r.startswith('❯ ') or notice) and i + 2 < len(tall):
        j = i + 1
        while not notice and j < len(tall) and tall[j].strip(): j += 1
        k = j + 1
        rows = []
        while k < len(tall) and tall[k].startswith('  ') and not tall[k].startswith('  ⎿'):
            rows.append(tall[k].strip()); k += 1
        found = ' '.join(rows) if rows and not tall[k - 1 if rows else k].startswith('⏺') and re.match(r'^(Read|Ran|Called|Edited|Searched|Listed|Wrote|Created|Fetched|Listed)', rows[0] if rows else '') else None
        if not notice: summaries.append(found)
        elif found: notices.append(found)

def snap_activity(part, sent, hi, reply_at, rep, replayed, windows=()):
    """The activity lines as the snaps show them while the turn worked: each
    label as drawn (a counted summary keeps its counts, bold), checked against
    the labels the replay derives from the session file; each tool line in
    full from the session file, found by the start the snap shows."""
    details = []
    for e in part:
        if e.get('type') != 'assistant': continue
        for c in e['message']['content']:
            if c.get('type') != 'tool_use': continue
            i = c.get('input', {})
            if c['name'] == 'Bash': details.append('$ ' + i['command'])
            elif c['name'] == 'Read': details.append(os.path.relpath(i['file_path'], cwd) if i['file_path'].startswith(cwd + '/') else i['file_path'])
            elif c['name'] in ('Grep', 'Glob'): details.append(f'"{i["pattern"]}"')
    squash = lambda x: re.sub(r'\s+', '', x)
    known = {re.sub(r'\*\*', '', st['line']) for st in rep['states']}
    out, last = [], None
    for sn in snaps:
        if not (sent + 1 <= sn['t'] < min(hi, reply_at)) or sn['dialog'] or sn['cols'] != 80: continue
        # While a dialog is open (its review screen has no "Enter to select"),
        # the activity line is its question, which the demo draws from the dialog.
        if any(a <= sn['t'] <= b for a, b in windows): continue
        raw = sn['raw'].split('\n')
        rows = [strip(r).rstrip() for r in raw]
        tool = next((i for i, r in enumerate(rows) if r.startswith('  ⎿  ')), None)
        if tool is None: continue
        # The label: rows up from the tool line to the bullet's, never into the
        # prompt above, whose rows Claude Code draws on grey.
        i, lab = tool - 1, []
        while i >= 0 and rows[i].strip() and '48;2;55;55;55' not in raw[i]:
            lab.insert(0, rows[i][2:].strip())
            if rows[i].startswith('⏺ '): break
            i -= 1
        label = ' '.join(lab)
        j, shown = tool + 1, [rows[tool][5:]]
        while j < len(rows) and rows[j].startswith('     ') and rows[j].strip():
            shown.append(rows[j][5:]); j += 1
        # A long-running command adds its time and output so far, and a hint.
        if shown[-1] == '(ctrl+b to run in background)': shown.pop()
        # The time and line count can wrap onto a row of their own.
        shown = re.sub(r' ?\n?\((\d+m )?\d+s( · \d+ ?\n?lines?)?\)$', '', '\n'.join(shown)).split('\n')
        cut = squash(''.join(shown)).rstrip('…')
        full = next((d for d in details if squash(d).startswith(cut)), None)
        # A command of many lines shows each line cut at the edge: its rows
        # then come in order, the first at the start.
        def rows_in(d):
            sd, pos = squash(d), 0
            for k, r in enumerate(squash(x).rstrip('…') for x in shown):
                at = sd.find(r, pos)
                if at < 0 or (k == 0 and at): return False
                pos = at + len(r)
            return True
        if full is None and len(shown) > 1: full = next((d for d in details if rows_in(d)), None)
        if full is None: raise SystemExit(f'{sn["file"]}: no tool in the session starts {cut[:60]!r}')
        counted = re.match(r'^(Reading|Editing|Searching|Calling|Running|Listing|Writing|Fetching)\b.*…$', label) and re.search(r'\d', label)
        if not counted and label not in known:
            print(f'{sn["file"]}: label not derived from the session: {label!r}', file=sys.stderr)
        line = re.sub(r'(\d+)', r'**\1**', label) if counted else re.sub(r'([\\*`])', r'\\\1', label)
        line = re.sub(r'\*\*(\d+)\*\*(?=[^ ]*[+-])', r'\1', line) if False else line
        key = (line, full)
        if key == last: continue
        last = key
        at = round(sn['t'] - sent, 1)
        out.append({'at': at, 'line': line, 'tool': full})
    return out

turns, abs_times = [], []
for n, a in enumerate(starts):
    b = starts[n + 1] if n + 1 < len(starts) else len(recs)
    part = recs[a:b]
    sent = ts(recs[a])
    with tempfile.NamedTemporaryFile('w', suffix='.jsonl', delete=False) as tf:
        tf.write('\n'.join(json.dumps(e) for e in part))
    rep = json.loads(subprocess.check_output(['node', os.path.join(os.path.dirname(__file__), 'replay.mjs'), tf.name, cwd]))
    texts = [(ts(e), c['text']) for e in part if e.get('type') == 'assistant' for c in e['message']['content'] if c.get('type') == 'text' and c['text'].strip()]
    reply_at, reply = texts[-1] if texts else (ts(part[-1]), '')
    key = shorts.get(str(n))
    if key:
        reply = short[key]
    turn = {'user': shown_prompt(recs[a]['message']['content'])}
    if turn['user'].startswith('<task-notification>'):
        drawn = notices.pop(0) if notices else None
    else:
        m = sum(1 for x in starts[:n] if not shown_prompt(recs[x]['message']['content']).startswith('<task-notification>'))
        drawn = summaries[m] if m < len(summaries) else None
    if drawn != (rep['final'] or None):
        print(f'turn {n}: tool summary drawn {drawn!r}, replayed {rep["final"]!r}; using the drawn one', file=sys.stderr)
    if drawn: turn['tools'] = drawn
    if any('[Request interrupted by user' in json.dumps(e.get('message', {}).get('content', '')) for e in part):
        turn['interrupted'] = True
    # Activity lines, as make.py read them from the replay.
    esc = lambda x: re.sub(r'([\\*`])', r'\\\1', x)
    activity, prev, ask_states = [], None, []
    asks = [(ts(e), c) for e in part if e.get('type') == 'assistant' for c in e['message']['content'] if c.get('type') == 'tool_use' and c['name'] == 'AskUserQuestion']
    for st in rep['states']:
        k = (st['line'], st['detail'])
        if st['why'].startswith('AskUserQuestion'):
            if k != prev: ask_states.append({'after': len(activity), 'tool': st['detail']})
            prev = k
            continue
        if not st['line'] or k == prev: continue
        prev = k
        activity.append({'at': round(st['at'] - sent, 1), 'line': st['line'] if st.get('move') else esc(st['line']),
                         **({'tool': st['detail']} if st['detail'] else {})})
    if '--activity-from-snaps' in opts:
        closes = [ts(next(e for e in part if e.get('type') == 'user' and isinstance(e.get('toolUseResult'), dict) and 'answers' in e['toolUseResult']
                          and any(c.get('tool_use_id') == use['id'] for c in e['message']['content'] if isinstance(c, dict)))) for _, use in asks]
        activity = snap_activity(part, sent, ts(recs[b]) if b < len(recs) else float('inf'), reply_at, rep, activity,
                                 [(o, c) for (o, _), c in zip(asks, closes)])
    if activity: turn['activity'] = activity
    # Each skill the turn launched, when its Skill call was logged: a chain's
    # chapter starts there (Demo.astro).
    launches = [{'at': round(ts(e) - sent, 3), 'skill': c['input']['skill']} for e in part if e.get('type') == 'assistant'
                for c in e['message']['content'] if c.get('type') == 'tool_use' and c['name'] == 'Skill']
    if launches: turn['launches'] = launches
    dialogs = []
    for n_ask, (opened, use) in enumerate(asks):
        res = next(e for e in part if e.get('type') == 'user' and isinstance(e.get('toolUseResult'), dict) and 'answers' in e['toolUseResult']
                   and any(c.get('tool_use_id') == use['id'] for c in e['message']['content'] if isinstance(c, dict)))
        r = res['toolUseResult']
        qs = []
        for q in r['questions']:
            ans = r['answers'][q['question']]
            labels = [o['label'] for o in q['options']]
            found = sorted((ans.find(lb), i) for i, lb in enumerate(labels) if lb in ans)
            rest = ans
            for _, i in found: rest = rest.replace(labels[i], '', 1)
            rest = rest.strip(', ').strip()
            if q.get('multiSelect') and rest:
                assert rest.startswith('"') and rest.endswith('"'), rest
                rest = rest[1:-1]
            note = ((r.get('annotations') or {}).get(q['question']) or {}).get('notes')
            qd = {'header': q['header'], 'question': q['question'], 'multiSelect': bool(q.get('multiSelect')),
                  'options': [{'label': o['label'], 'description': o['description'], **({'preview': o['preview']} if 'preview' in o else {})} for o in q['options']],
                  'picked': [i for _, i in found]}
            # One pick is the label alone, even when another label starts it
            # ("Let it run" in "Let it run, alert"); anything else was typed,
            # even when it starts with a label ("None in 50. And the top 3 ...").
            if not q.get('multiSelect'):
                qd['picked'] = [labels.index(ans)] if ans in labels else []
                if ans not in labels: qd['typed'] = ans
            elif rest and not found: qd['typed'] = rest
            elif rest: raise SystemExit(f'answer has words beyond its pick: {ans!r}')
            if note: qd['notes'] = note
            qs.append(qd)
        st = ask_states[n_ask] if n_ask < len(ask_states) else {}
        after = sum(1 for a in activity if a['at'] < opened - sent) if '--activity-from-snaps' in opts else st.get('after', len(activity))
        dialogs.append({'at': [round(opened - sent, 1), round(ts(res) - sent, 1)], 'after': after,
                        **({'tool': st['tool']} if st.get('tool') else {}), 'questions': qs})
    if dialogs: turn['dialogs'] = dialogs
    turn['replyAt'] = round(reply_at - sent, 1)
    abs_times.append((sent, reply_at))
    # Chrome from the snaps between the previous reply and the next prompt.
    lo = ts(recs[starts[n - 1]]) if n else 0
    hi = ts(recs[b]) if b < len(recs) else float('inf')
    chrome, last = [], None
    for s in snaps:
        if not (lo < s['t'] < hi) or s['dialog'] or 'context' not in s or s.get('cut') or s['cols'] != 80: continue
        c = chrome_of(s)
        if c != last:
            chrome.append([round(s['t'] - sent, 1), c])
            last = c
    # A turn run with moo off ends where its session did: snaps after its
    # reply that name another output style come from the session resumed for
    # the next turn, whose own chrome holds them.
    at_reply = next((c for x, c in reversed(chrome) if x <= reply_at - sent), {})
    chrome = [[x, c] for x, c in chrome if x <= reply_at - sent or c.get('style') == at_reply.get('style')]
    turn['chrome'] = chrome
    toast = next((toast_of(s['raw']) for s in snaps if reply_at <= s['t'] < hi and toast_of(s['raw'])), None)
    if toast: turn['toast'] = toast
    turn['reply'] = reply.split('\n')
    turns.append(turn)

# The recorder's keys, each in the turn it drove: a key belongs to the turn
# whose reply had not yet come in. Seconds after that turn's prompt was sent.
# A key pressed before sending stays before it: rounding can't take it to 0.
for e in events:
    n = min(sum(1 for _, r in abs_times if r < e['t']), len(turns) - 1)
    at = e['t'] - abs_times[n][0]
    turns[n].setdefault('keys', []).append([round(at, 1) if at >= 0 or round(at, 1) < 0 else -0.1, e['kind'], e['value']])
# The Enter that sent a prompt can land a moment after the session file's
# send time, the two clocks apart: within a second, it is still the send.
for turn in turns:
    keys = turn.get('keys', [])
    if not any(at < 0 and kind == 'key' and v == 'Enter' for at, kind, v in keys):
        k = next((k for k, (at, kind, v) in enumerate(keys) if kind == 'key' and v == 'Enter' and at <= 1.0), None)
        if k is not None: keys[k][0] = -0.1

COLORS = {'38;2;177;185;249': 'l', '38;2;153;153;153': 'g'}
def segs_of(raw):
    """A captured row as [text, class] pairs, for the classes the menu uses."""
    out, color, bold = [], None, False
    for k, part in enumerate(re.split(r'(\x1b\[[0-9;]*m)', raw)):
        if k % 2:
            code = part[2:-1]
            if code in COLORS: color = COLORS[code]
            elif code == '39': color = None
            elif code == '1': bold = True
            elif code in ('0', ''): color, bold = None, False
            elif code == '22': bold = False
            else: raise SystemExit(f'menu row has an unknown style {code!r}: {raw!r}')
        elif part:
            cls = ' '.join(x for x in (color, 'b' if bold else None) if x)
            if out and out[-1][1:] == ([cls] if cls else []): out[-1][0] += part
            else: out.append([part, cls] if cls else [part])
    return out

# The slash menu Claude Code drew over the prompt while typed text sat in it,
# from the first 80-column snap between that text and the next key.
for n, turn in enumerate(turns):
    keys = turn.get('keys', [])
    for ki, (at, kind, value) in enumerate(keys):
        if kind != 'type' or at >= 0: continue
        until = keys[ki + 1][0] if ki + 1 < len(keys) else 0
        lo_t, hi_t = abs_times[n][0] + at, abs_times[n][0] + until
        for sn in snaps:
            if not (int(lo_t) <= sn['t'] < hi_t) or sn['cols'] != 80 or sn['dialog']: continue
            raw = sn['raw'].split('\n')
            rows = [strip(r).rstrip() for r in raw]
            rules = [i for i, r in enumerate(rows) if r and set(r) == {'─'}]
            if len(rules) < 2: continue
            i, menu = rules[-2] - 1, []
            while i >= 0 and (re.match(r'^  (❯ |  )/', rows[i]) or re.match(r'^ {36}\S', rows[i])):
                menu.insert(0, segs_of(raw[i].replace('\xa0', ' '))); i -= 1
            if menu:
                if 'menu' in turn: raise SystemExit(f'turn {n}: two menus')
                turn['menu'] = {'after': ki, 'rows': menu}
                break

# A subagent's task notification is no prompt: Claude Code drew no prompt row,
# only the tool summary and the reply it led to, under the turn before.
for k in range(len(turns) - 1, 0, -1):
    if turns[k]['user'].startswith('<task-notification>'):
        t = turns.pop(k)
        assert not t.get('keys') and not t.get('dialogs'), 'a task notification with keys or dialogs'
        turns[k - 1]['more'] = [{**({'tools': t['tools']} if t.get('tools') else {}), 'reply': t['reply']}, *t.get('more', []), *turns[k - 1].get('more', [])]

first = next(s for s in snaps if 'context' in s)
J = lambda v: json.dumps(v, ensure_ascii=False)
lines = [*(f'// {c}' for c in comment.split('\n') if comment), 'import type { Chrome, Turn } from "../types";', '',
         f'export const chrome: Chrome = {J(chrome_of(first))};', '', 'export const turns: Turn[] = [']
for t in turns:
    lines.append('  {')
    for k, v in t.items():
        if k == 'reply': lines += ['    reply: [', *(f'      {J(x)},' for x in v), '    ],']
        elif k in ('activity', 'launches', 'chrome'): lines += [f'    {k}: [', *(f'      {J(x)},' for x in v), '    ],']
        else: lines.append(f'    {k}: {json.dumps(v, ensure_ascii=False, indent=2).replace(chr(10), chr(10) + "    ")},')
    lines.append('  },')
lines += ['];', '']
HOME = os.path.expanduser('~')
SLUG = re.sub(r'[/.]', '-', HOME)  # how Claude Code names the home folder's projects
def renamed(text):
    """Every path under the home folder written ~/…, and a project folder's
    name under ~/.claude/projects written for a user named dev, as the user
    asked: the site shows no home path and no username."""
    return text.replace(HOME + '/', '~/').replace(HOME, '~').replace(SLUG + '-', '-Users-dev-')
module = renamed('\n'.join(lines))
user = os.path.basename(HOME)
for name in {user, re.sub(r'[.]', '-', user)}:
    if name.lower() in module.lower():
        raise SystemExit(f'{out}: names the user ({name!r}) after renaming')
open(out, 'w').write(module)
if raw_out:
    json.dump(turns, open(raw_out, 'w'), ensure_ascii=False)
    # The session file beside them, for check-timing.mts to read its Skill calls itself.
    open(re.sub(r'\.json$', '', raw_out) + '.src', 'w').write(os.path.abspath(sess))
print(out, [(t['user'][:40], len(t.get('activity', [])), len(t['chrome']), t.get('toast'), len(t.get('dialogs', [])), len(t.get('keys', [])), bool(t.get('menu'))) for t in turns])
