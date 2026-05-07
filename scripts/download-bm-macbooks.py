"""
Downloads the 8 MacBook M-series hero images from Backmarket via the cdn-cgi/image proxy
(it accepts a 1000px width override), removes the white background, and saves as transparent WebP.
"""
import json
import os
import urllib.request
import urllib.parse
from PIL import Image, ImageFilter
from io import BytesIO

OUTDIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'devices')
os.makedirs(OUTDIR, exist_ok=True)

# Map BM series name -> output filename
MAPPING = {
    'MacBook Pro (M1 series)': 'macbook-pro-m1.webp',
    'MacBook Pro (M2 series)': 'macbook-pro-m2.webp',
    'MacBook Pro (M3 series)': 'macbook-pro-m3.webp',
    'MacBook Pro (M4 series)': 'macbook-pro-m4.webp',
    'MacBook Air (M1 series)': 'macbook-air-m1.webp',
    'MacBook Air (M2 series)': 'macbook-air-m2.webp',
    'MacBook Air (M3 series)': 'macbook-air-m3.webp',
    'MacBook Air (M4 series)': 'macbook-air-m4.webp',
}

with open(os.path.join(os.path.dirname(__file__), 'backmarket-macbook-urls.json'), 'r') as f:
    products = json.load(f)

req_headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
}

def remove_white_bg(img):
    """Convert white/near-white pixels around the edges to transparent.
    Uses corner-seed flood fill + alpha edge cleanup."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    visited = [[False]*h for _ in range(w)]
    stack = []
    # Seed from edges (every 8 px)
    for x in range(0, w, 8):
        stack.append((x, 0))
        stack.append((x, h-1))
    for y in range(0, h, 8):
        stack.append((0, y))
        stack.append((w-1, y))
    threshold = 230  # near-white
    while stack:
        x, y = stack.pop()
        if x < 0 or x >= w or y < 0 or y >= h: continue
        if visited[x][y]: continue
        visited[x][y] = True
        r, g, b, a = px[x, y]
        if r >= threshold and g >= threshold and b >= threshold:
            px[x, y] = (r, g, b, 0)
            stack.append((x+1, y))
            stack.append((x-1, y))
            stack.append((x, y+1))
            stack.append((x, y-1))
    # Second pass: kill any remaining bright-gray bleed (channel-equality)
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a > 0 and min(r,g,b) > 225 and max(r,g,b)-min(r,g,b) < 18:
                px[x, y] = (r, g, b, 0)
    return img

for p in products:
    name = p.get('name', '')
    if name not in MAPPING:
        continue
    out_filename = MAPPING[name]
    out_path = os.path.join(OUTDIR, out_filename)
    if os.path.exists(out_path):
        # Force re-download to refresh
        pass
    img_url = p['imageUrl']
    # Bump width to 1000
    img_url = img_url.replace('width%3D260', 'width%3D1000')
    print(f'Downloading {name} -> {out_filename}')
    req = urllib.request.Request(img_url, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
    except Exception as e:
        print(f'  FAIL: {e}')
        continue
    img = Image.open(BytesIO(data))
    img = remove_white_bg(img)
    # Resize to max 800px on longest edge
    img.thumbnail((800, 800), Image.LANCZOS)
    img.save(out_path, 'WEBP', quality=85, method=6)
    print(f'  saved {out_path} ({os.path.getsize(out_path)} bytes)')

print('Done.')
