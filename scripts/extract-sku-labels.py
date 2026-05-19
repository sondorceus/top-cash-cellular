import sys, re, json
sys.stdout.reconfigure(encoding='utf-8')

src = open('app/data/prices.ts', encoding='utf-8').read()
page = open('app/page.tsx', encoding='utf-8').read()

m = re.search(r'export const PRICE_TABLE[^=]*=\s*\{(.*?)^\};', src, re.S | re.M)
pt_skus = re.findall(r'^  ([a-z][a-z0-9]*): \{', m.group(1), re.M)

labels_raw = {}
for sku, label in re.findall(r'\{\s*id:\s*[\"\']([^\"\']+)[\"\'],\s*label:\s*[\"\']([^\"\']+)[\"\']', page):
    if sku not in labels_raw:
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
