"""
Downloads Backmarket product images for multiple categories, removes white BG,
saves as transparent WebP under public/devices/.

Reads scripts/bm-multi-products.json and produces a series of TCC variant -> image mappings.
"""
import json
import os
import re
import urllib.request
from PIL import Image
from io import BytesIO

OUTDIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'devices')
os.makedirs(OUTDIR, exist_ok=True)

req_headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
}

# Mapping: (category_key, regex_match_on_name, output_filename)
# Regex must be case-insensitive. First match wins.
MAPPINGS = [
    # Apple Watch
    ('apple-watch', r'Series 10\b', 'apple-watch-series-10.webp'),
    ('apple-watch', r'Series 9\b', 'apple-watch-series-9.webp'),
    ('apple-watch', r'Series 8\b', 'apple-watch-series-8.webp'),
    ('apple-watch', r'Series 7\b', 'apple-watch-series-7.webp'),
    ('apple-watch', r'Ultra 2\b', 'apple-watch-ultra-2.webp'),
    ('apple-watch', r'Ultra(?!\s*[123])', 'apple-watch-ultra.webp'),  # plain Ultra
    ('apple-watch', r'SE Series 1\b', 'apple-watch-se-1.webp'),
    ('apple-watch', r'SE Series 2\b', 'apple-watch-se-2.webp'),
    # Samsung Watch
    ('samsung-watch', r'Watch 7\b', 'samsung-watch-7.webp'),
    ('samsung-watch', r'Watch 6 Classic', 'samsung-watch-6-classic.webp'),
    ('samsung-watch', r'Watch 6\b', 'samsung-watch-6.webp'),
    ('samsung-watch', r'Watch 5 Pro|Watch5 Pro', 'samsung-watch-5-pro.webp'),
    ('samsung-watch', r'Watch 5\b', 'samsung-watch-5.webp'),
    ('samsung-watch', r'Watch Ultra', 'samsung-watch-ultra.webp'),
    # Galaxy Tab
    ('samsung-tab', r'Tab S9 Ultra', 'galaxy-tab-s9-ultra.webp'),
    ('samsung-tab', r'Tab S9\+|Tab S9 Plus', 'galaxy-tab-s9-plus.webp'),
    ('samsung-tab', r'Tab S9 FE\+|Tab S9\s*FE\+', 'galaxy-tab-s9-fe-plus.webp'),
    ('samsung-tab', r'Tab S9 FE\b', 'galaxy-tab-s9-fe.webp'),
    ('samsung-tab', r'Tab S9\b', 'galaxy-tab-s9.webp'),
    ('samsung-tab', r'Tab S8 Ultra', 'galaxy-tab-s8-ultra.webp'),
    ('samsung-tab', r'Tab S8\+|Tab S8 Plus', 'galaxy-tab-s8-plus.webp'),
    ('samsung-tab', r'Tab S8\b', 'galaxy-tab-s8.webp'),
    ('samsung-tab', r'Tab A9\+|Tab A9 Plus', 'galaxy-tab-a9-plus.webp'),
    # Consoles
    ('playstation', r'PlayStation 5 Slim Digital', 'ps5-slim-digital.webp'),
    ('playstation', r'PlayStation 5 Slim\b.*Disc', 'ps5-slim-disc.webp'),
    ('playstation', r'PlayStation 5 Digital', 'ps5-digital.webp'),
    ('playstation', r'PlayStation 5(?!\s*(?:Slim|Digital|Pro))', 'ps5.webp'),
    ('playstation', r'PlayStation 4 Pro', 'ps4-pro.webp'),
    ('playstation', r'PlayStation 4 Slim', 'ps4-slim.webp'),
    ('playstation', r'PlayStation 4(?!\s*(?:Pro|Slim))', 'ps4.webp'),
    ('xbox', r'Series X', 'xbox-series-x.webp'),
    ('xbox', r'Series S', 'xbox-series-s.webp'),
    ('xbox', r'Xbox One X', 'xbox-one-x.webp'),
    ('xbox', r'Xbox One S', 'xbox-one-s.webp'),
    ('xbox', r'Xbox One(?!\s*[XS])', 'xbox-one.webp'),
    ('nintendo', r'Switch OLED', 'switch-oled.webp'),
    ('nintendo', r'Switch Lite', 'switch-lite.webp'),
    ('nintendo', r'^Switch(?!\s*(?:OLED|Lite))', 'switch.webp'),
    # Pixel phones
    ('pixel', r'Pixel 9 Pro XL', 'pixel-9-pro-xl.webp'),
    ('pixel', r'Pixel 9 Pro\b', 'pixel-9-pro.webp'),
    ('pixel', r'Pixel 9a\b', 'pixel-9a.webp'),
    ('pixel', r'Pixel 9\b', 'pixel-9.webp'),
    ('pixel', r'Pixel 8 Pro', 'pixel-8-pro.webp'),
    ('pixel', r'Pixel 8a\b', 'pixel-8a.webp'),
    ('pixel', r'Pixel 8\b', 'pixel-8.webp'),
    ('pixel', r'Pixel 7 Pro', 'pixel-7-pro.webp'),
    ('pixel', r'Pixel 7a\b', 'pixel-7a.webp'),
    ('pixel', r'Pixel 7\b', 'pixel-7.webp'),
    ('pixel', r'Pixel 6 Pro', 'pixel-6-pro.webp'),
    ('pixel', r'Pixel 6a\b', 'pixel-6a.webp'),
    ('pixel', r'Pixel 6\b', 'pixel-6.webp'),
    # iPad (refresh existing per-variant)
    ('ipad', r'iPad Pro\b.*M4', 'ipad-pro-m4.webp'),
    ('ipad', r'iPad Pro\b.*M2', 'ipad-pro-m2.webp'),
    ('ipad', r'iPad Pro\b.*M1', 'ipad-pro-m1.webp'),
    ('ipad', r'iPad Air 6\b|iPad Air\b.*2024', 'ipad-air-6.webp'),
    ('ipad', r'iPad Air 5\b|iPad Air\b.*M1', 'ipad-air-5.webp'),
    ('ipad', r'iPad Air 4\b|iPad Air\b.*A14', 'ipad-air-4.webp'),
    ('ipad', r'iPad mini 7\b|iPad mini\b.*A17', 'ipad-mini-7.webp'),
    ('ipad', r'iPad mini 6\b|iPad mini\b.*A15', 'ipad-mini-6.webp'),
    ('ipad', r'iPad 11\b', 'ipad-11.webp'),
    ('ipad', r'iPad 10\b', 'ipad-10.webp'),
    ('ipad', r'iPad 9\b', 'ipad-9.webp'),
    ('ipad', r'iPad 8\b', 'ipad-8.webp'),
    # iPhone — single image per generation since variants share image at series level
    ('iphone', r'iPhone 17 Pro Max', 'iphone-17-pro-max.webp'),
    ('iphone', r'iPhone 17 Pro\b', 'iphone-17-pro.webp'),
    ('iphone', r'iPhone 17 Plus|iPhone 17 Air', 'iphone-17-plus.webp'),
    ('iphone', r'iPhone 17(?!\s*(?:Pro|Plus|Air|e))', 'iphone-17.webp'),
    ('iphone', r'iPhone 16 Pro Max', 'iphone-16-pro-max.webp'),
    ('iphone', r'iPhone 16 Pro\b', 'iphone-16-pro.webp'),
    ('iphone', r'iPhone 16 Plus', 'iphone-16-plus.webp'),
    ('iphone', r'iPhone 16e', 'iphone-16e.webp'),
    ('iphone', r'iPhone 16(?!\s*(?:Pro|Plus|e))', 'iphone-16.webp'),
    ('iphone', r'iPhone 15 Pro Max', 'iphone-15-pro-max.webp'),
    ('iphone', r'iPhone 15 Pro\b', 'iphone-15-pro.webp'),
    ('iphone', r'iPhone 15 Plus', 'iphone-15-plus.webp'),
    ('iphone', r'iPhone 15(?!\s*(?:Pro|Plus))', 'iphone-15.webp'),
    ('iphone', r'iPhone 14 Pro Max', 'iphone-14-pro-max.webp'),
    ('iphone', r'iPhone 14 Pro\b', 'iphone-14-pro.webp'),
    ('iphone', r'iPhone 14 Plus', 'iphone-14-plus.webp'),
    ('iphone', r'iPhone 14(?!\s*(?:Pro|Plus))', 'iphone-14.webp'),
    ('iphone', r'iPhone 13 Pro Max', 'iphone-13-pro-max.webp'),
    ('iphone', r'iPhone 13 Pro\b', 'iphone-13-pro.webp'),
    ('iphone', r'iPhone 13 mini', 'iphone-13-mini.webp'),
    ('iphone', r'iPhone 13(?!\s*(?:Pro|mini))', 'iphone-13.webp'),
]


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
    # Kill any remaining gray fringe via channel-equality
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a > 0 and min(r,g,b) > 225 and max(r,g,b)-min(r,g,b) < 18:
                px[x, y] = (r, g, b, 0)
    return img


def main():
    with open(os.path.join(os.path.dirname(__file__), 'bm-multi-products.json'), 'r') as f:
        data = json.load(f)
    used_filenames = set()
    downloaded = 0
    skipped = 0
    failed = 0
    for cat_key, regex, out_filename in MAPPINGS:
        if out_filename in used_filenames:
            continue
        products = data.get(cat_key, [])
        if not isinstance(products, list):
            continue
        match = None
        for p in products:
            if re.search(regex, p.get('name', ''), re.IGNORECASE):
                match = p
                break
        if not match:
            print(f'  SKIP no match: {cat_key} / {regex} -> {out_filename}')
            skipped += 1
            continue
        out_path = os.path.join(OUTDIR, out_filename)
        img_url = match['imageUrl']
        # Bump width
        img_url = img_url.replace('width%3D260', 'width%3D1000')
        try:
            req = urllib.request.Request(img_url, headers=req_headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                buf = resp.read()
            img = Image.open(BytesIO(buf))
            img = remove_white_bg(img)
            img.thumbnail((800, 800), Image.LANCZOS)
            img.save(out_path, 'WEBP', quality=85, method=6)
            print(f'  OK   {out_filename:35s} <- {match["name"][:60]}')
            used_filenames.add(out_filename)
            downloaded += 1
        except Exception as e:
            print(f'  FAIL {out_filename}: {e}')
            failed += 1
    print(f'\nDone. Downloaded {downloaded}, skipped {skipped}, failed {failed}.')


if __name__ == '__main__':
    main()
