import sys, re, json
sys.stdout.reconfigure(encoding='utf-8')

src = open('app/data/prices.ts', encoding='utf-8').read()
page = open('app/page.tsx', encoding='utf-8').read()
# The /go board lists a few models the homepage doesn't (ip13mini, nsw2) —
# without it a rerun silently dropped their labels, and with them the
# server's anti-tamper cap for those leads (app/lib/server-quote-cap.ts).
board = open('app/go/board.ts', encoding='utf-8').read()

m = re.search(r'export const PRICE_TABLE[^=]*=\s*\{(.*?)^\};', src, re.S | re.M)
# Ids may contain underscores (mbp14_m5pmax_2026, dji_mini_4_pro, avp_m5) —
# the old [a-z0-9]* pattern skipped all of them.
pt_skus = re.findall(r'^  ([a-z][a-z0-9_]*): \{', m.group(1), re.M)

# Resolve TS string escapes: \" → "
unescape = lambda s: s.replace('\\"', '"').replace("\\'", "'")

labels_raw = {}
# Use a regex that handles escaped quotes inside the label (e.g. `iPad Air 11\" (M3)`).
for m in re.finditer(r'\{\s*id:\s*"([^"]+)",\s*label:\s*"((?:[^"\\]|\\.)*)"', page):
    sku, label = m.group(1), m.group(2)
    if sku in labels_raw: continue
    labels_raw[sku] = unescape(label)
# Board entries: phone("id", "Label", …) / console_(…) / ipad(…) / mac(…).
# The homepage label wins when both exist (ps4 is "PlayStation 4 (Standard)"
# there; the server also resolves the board's shorter label on its own).
for m in re.finditer(r'\b(?:phone|console_|ipad|mac)\(\s*"([^"]+)",\s*"((?:[^"\\]|\\.)*)"', board):
    sku, label = m.group(1), m.group(2)
    if sku in labels_raw: continue
    labels_raw[sku] = unescape(label)

norm = lambda s: re.sub(r'\s+', ' ', s.lower()).strip()
out = {}
owner = {}
missing = []
for sku in pt_skus:
    if sku not in labels_raw:
        missing.append(sku)
        continue
    label = labels_raw[sku]
    # Labels must stay unique — the server maps label → id. A second id
    # carrying the same label (nswoled → "Nintendo Switch OLED", already
    # `switch`) is left out instead of silently stealing the label.
    if norm(label) in owner:
        print(f'  skipped {sku}: label "{label}" already belongs to {owner[norm(label)]}')
        continue
    owner[norm(label)] = sku
    out[sku] = label

print('Mapped:', len(out), ' Missing:', len(missing))
for s in missing: print('  missing label for:', s)

# Save as JSON for safe reading from TS. Sorted keys + trailing newline =
# the checked-in layout, so a rerun only diffs real label changes.
with open('app/data/sku-labels.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)
    f.write('\n')
print('wrote app/data/sku-labels.json')
