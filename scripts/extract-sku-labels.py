import sys, re, json
sys.stdout.reconfigure(encoding='utf-8')

src = open('app/data/prices.ts', encoding='utf-8').read()
page = open('app/page.tsx', encoding='utf-8').read()

m = re.search(r'export const PRICE_TABLE[^=]*=\s*\{(.*?)^\};', src, re.S | re.M)
pt_skus = re.findall(r'^  ([a-z][a-z0-9]*): \{', m.group(1), re.M)

labels_raw = {}
# Use a regex that handles escaped quotes inside the label (e.g. `iPad Air 11\" (M3)`).
for m in re.finditer(r'\{\s*id:\s*"([^"]+)",\s*label:\s*"((?:[^"\\]|\\.)*)"', page):
    sku, label = m.group(1), m.group(2)
    if sku in labels_raw: continue
    # Resolve TS string escapes: \" → "
    label = label.replace('\\"', '"').replace("\\'", "'")
    labels_raw[sku] = label

out = {}
missing = []
for sku in pt_skus:
    if sku in labels_raw:
        out[sku] = labels_raw[sku]
    else:
        missing.append(sku)

print('Mapped:', len(out), ' Missing:', len(missing))
for s in missing: print('  missing label for:', s)

# Save as JSON for safe reading from TS
with open('app/data/sku-labels.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
print('wrote app/data/sku-labels.json')
