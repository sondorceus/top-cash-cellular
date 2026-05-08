"""
Downloads images from bm-search-products.json, processes for transparency, saves to /devices/.
"""
import json
import os
import urllib.request
from PIL import Image
from io import BytesIO

OUTDIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'devices')
os.makedirs(OUTDIR, exist_ok=True)

req_headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
}

# key -> output filename
MAPPING = {
    'hp-spectre-x360-16': 'hp-spectre-x360.webp',
    'hp-envy-15': 'hp-envy-15.webp',
    'hp-envy-16': 'hp-envy-16.webp',
    'hp-pavilion-15': 'hp-pavilion-15.webp',
    'hp-victus-15': 'hp-victus-15.webp',
    'acer-nitro-5': 'acer-nitro-5.webp',
    'acer-predator-helios': 'acer-predator.webp',
    'acer-swift-go': 'acer-swift.webp',
    'acer-aspire': 'acer-aspire.webp',
    'asus-rog-strix': 'asus-rog-strix.webp',
    'asus-rog-zephyrus': 'asus-rog-zephyrus.webp',
    'asus-tuf-gaming': 'asus-tuf-gaming.webp',
    'asus-zenbook': 'asus-zenbook.webp',
    'asus-vivobook': 'asus-vivobook.webp',
    'dell-inspiron-15': 'dell-inspiron-15.webp',
    'dell-g15': 'dell-g15.webp',
    'razer-blade-15': 'razer-blade-15.webp',
    'msi-stealth': 'msi-stealth.webp',
    'msi-katana': 'msi-katana.webp',
    'imac-24-m4': 'imac-24-m4.webp',
    'imac-24-m3': 'imac-24-m3.webp',
    'imac-24-m1': 'imac-24-m1.webp',
    'mac-mini-m2': 'mac-mini-m2.webp',
    'mac-mini-m1': 'mac-mini-m1.webp',
    'mac-studio-m2': 'mac-studio-m2.webp',
    'hp-elitedesk-800': 'hp-elitedesk-800.webp',
    'hp-prodesk-400': 'hp-prodesk-400.webp',
    'lenovo-ideacentre': 'lenovo-ideacentre.webp',
    'airpods-pro-2': 'airpods-pro-2.webp',
    'airpods-pro': 'airpods-pro.webp',
    'airpods-3': 'airpods-3.webp',
    'airpods-max': 'airpods-max.webp',
    'meta-quest-3': 'meta-quest-3.webp',
}


def remove_white_bg(img):
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    visited = [[False]*h for _ in range(w)]
    stack = []
    for x in range(0, w, 6):
        stack.append((x, 0)); stack.append((x, h-1))
    for y in range(0, h, 6):
        stack.append((0, y)); stack.append((w-1, y))
    threshold = 230
    while stack:
        x, y = stack.pop()
        if x < 0 or x >= w or y < 0 or y >= h: continue
        if visited[x][y]: continue
        visited[x][y] = True
        r, g, b, a = px[x, y]
        if r >= threshold and g >= threshold and b >= threshold:
            px[x, y] = (r, g, b, 0)
            stack.extend([(x+1, y), (x-1, y), (x, y+1), (x, y-1)])
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a > 0 and min(r,g,b) > 225 and max(r,g,b)-min(r,g,b) < 18:
                px[x, y] = (r, g, b, 0)
    return img


def main():
    with open(os.path.join(os.path.dirname(__file__), 'bm-search-products.json'), 'r') as f:
        results = json.load(f)
    ok = fail = skip = 0
    for key, out_filename in MAPPING.items():
        data = results.get(key)
        if not data or 'imageUrl' not in data:
            skip += 1
            print(f'  SKIP no data: {key}')
            continue
        img_url = data['imageUrl'].replace('width%3D260', 'width%3D1000')
        try:
            req = urllib.request.Request(img_url, headers=req_headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                buf = resp.read()
            img = Image.open(BytesIO(buf))
            img = remove_white_bg(img)
            img.thumbnail((800, 800), Image.LANCZOS)
            img.save(os.path.join(OUTDIR, out_filename), 'WEBP', quality=85, method=6)
            print(f'  OK   {out_filename:35s} <- {data["name"][:55]}')
            ok += 1
        except Exception as e:
            print(f'  FAIL {out_filename}: {e}')
            fail += 1
    print(f'\nOK {ok}, fail {fail}, skip {skip}')


if __name__ == '__main__':
    main()
