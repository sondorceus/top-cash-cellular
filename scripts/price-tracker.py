#!/usr/bin/env python3
"""Price Tracker — single source of truth for all device pricing data.

Saves/loads/searches all pricing data locally. Quick reference for any device.

Usage:
  python3 price-tracker.py status              # Overview of all pricing data
  python3 price-tracker.py search "iPhone 16"  # Search for a device
  python3 price-tracker.py lookup ip16pm       # Lookup by device ID
  python3 price-tracker.py compare ip16pm      # Compare our price vs IWM live
  python3 price-tracker.py export              # Export all pricing to CSV
  python3 price-tracker.py save                # Save current site prices to local DB
  python3 price-tracker.py history ip16pm      # Show price history for a device
"""
import sys, json, os, re, csv, time
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
DB_DIR = os.path.join(ROOT, "price-data")
DB_FILE = os.path.join(DB_DIR, "price-db.json")
HISTORY_FILE = os.path.join(DB_DIR, "price-history.json")

os.makedirs(DB_DIR, exist_ok=True)

def load_db():
    if os.path.exists(DB_FILE):
        return json.load(open(DB_FILE))
    return {}

def save_db(db):
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=2)

def load_history():
    if os.path.exists(HISTORY_FILE):
        return json.load(open(HISTORY_FILE))
    return {}

def save_history(history):
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)

def extract_from_site():
    """Extract all pricing data from page.tsx PRICE_TABLE."""
    with open(os.path.join(ROOT, "app/page.tsx")) as f:
        code = f.read()

    # Extract device ID → label mapping
    labels = {}
    for m in re.finditer(r'\{\s*id:\s*"(\w+)",\s*label:\s*"([^"]+)"', code):
        labels[m.group(1)] = m.group(2)

    # Extract PRICE_TABLE
    table_match = re.search(r'const PRICE_TABLE[^{]*\{(.+?)^};', code, re.DOTALL | re.MULTILINE)
    if not table_match:
        return {}, labels

    # Parse the table (simplified — just count entries per device)
    prices = {}
    current_device = None
    current_storage = None

    for line in table_match.group(1).split("\n"):
        device_m = re.match(r'\s+(\w+):\s*\{', line)
        if device_m:
            current_device = device_m.group(1)
            prices[current_device] = {}
            continue

        storage_m = re.match(r'\s+"([^"]+)":\s*\{(.+)\}', line)
        if storage_m and current_device:
            sid = storage_m.group(1)
            conds_str = storage_m.group(2)
            conds = {}
            for cm in re.finditer(r'(\w+):\s*(\d+)', conds_str):
                conds[cm.group(1)] = int(cm.group(2))
            prices[current_device][sid] = conds

    return prices, labels

def save_snapshot():
    """Save current site prices to local DB with timestamp."""
    prices, labels = extract_from_site()

    db = load_db()
    history = load_history()
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")

    for did, storages in prices.items():
        db[did] = {
            "label": labels.get(did, did),
            "prices": storages,
            "updated": ts,
        }
        # Track history
        if did not in history:
            history[did] = []
        # Only add if prices changed
        last = history[did][-1] if history[did] else None
        if not last or last.get("prices") != storages:
            history[did].append({"ts": ts, "prices": storages})

    save_db(db)
    save_history(history)

    # Also save raw JSON files for reference
    with open(os.path.join(DB_DIR, "price-table-snapshot.json"), "w") as f:
        json.dump(prices, f, indent=2)

    # Save IWM scrape data if it exists
    for fname in ["iwm-all-prices.json", "macbook-iwm-adjustments.json",
                   "ebay-resell-data.json", "swappa-resell-data.json",
                   "console-resell-data.json"]:
        src = os.path.join(ROOT, fname)
        if os.path.exists(src):
            dst = os.path.join(DB_DIR, fname)
            with open(src) as sf:
                data = json.load(sf)
            with open(dst, "w") as df:
                json.dump(data, df, indent=2)

    print(f"Saved {len(prices)} devices to {DB_FILE}")
    print(f"History: {len(history)} devices tracked")
    print(f"Snapshot: {DB_DIR}/price-table-snapshot.json")

def show_status():
    """Show overview of all pricing data."""
    db = load_db()
    if not db:
        print("No data. Run: python3 price-tracker.py save")
        return

    # Group by type
    cats = {}
    for did, info in db.items():
        label = info.get("label", did)
        if "iPhone" in label: cat = "iPhone"
        elif "Galaxy S" in label or "Galaxy Z" in label or "Galaxy Note" in label: cat = "Samsung Phone"
        elif "Galaxy Tab" in label: cat = "Samsung Tablet"
        elif "Galaxy Watch" in label: cat = "Samsung Watch"
        elif "Pixel" in label and "Watch" in label: cat = "Pixel Watch"
        elif "Pixel" in label: cat = "Pixel Phone"
        elif "MacBook" in label: cat = "MacBook"
        elif "Mac" in label or "iMac" in label: cat = "Apple Desktop"
        elif "iPad" in label: cat = "iPad"
        elif "Watch" in label: cat = "Watch"
        elif "PlayStation" in label or "Xbox" in label or "Switch" in label: cat = "Console"
        elif "Garmin" in label: cat = "Garmin"
        else: cat = "Other"
        cats.setdefault(cat, []).append((did, info))

    total = len(db)
    total_combos = sum(sum(len(v) for v in info["prices"].values()) for info in db.values())

    print(f"=== PRICE TRACKER: {total} devices, {total_combos} price combos ===")
    print(f"Last updated: {max(info.get('updated','?') for info in db.values())}")
    print()

    for cat in sorted(cats):
        items = cats[cat]
        combos = sum(sum(len(v) for v in info["prices"].values()) for _, info in items)
        print(f"  {cat:20s} {len(items):3d} devices  {combos:4d} combos")

def search(query):
    """Search for devices matching query."""
    db = load_db()
    query_lower = query.lower()

    matches = [(did, info) for did, info in db.items()
               if query_lower in did.lower() or query_lower in info.get("label", "").lower()]

    if not matches:
        print(f"No matches for '{query}'")
        return

    print(f"Found {len(matches)} matches for '{query}':\n")
    for did, info in matches:
        label = info.get("label", did)
        prices = info.get("prices", {})
        print(f"  {did:20s} {label}")
        for sid in sorted(prices):
            conds = prices[sid]
            vals = ", ".join(f"{c}=${p}" for c, p in sorted(conds.items(), key=lambda x: -x[1]))
            print(f"    {sid:8s}: {vals}")
        print()

def lookup(device_id):
    """Lookup a specific device by ID."""
    db = load_db()
    if device_id not in db:
        print(f"Device '{device_id}' not found. Try: python3 price-tracker.py search <name>")
        return

    info = db[device_id]
    print(f"\n=== {info.get('label', device_id)} ({device_id}) ===")
    print(f"Updated: {info.get('updated', '?')}")
    print()

    prices = info.get("prices", {})
    for sid in sorted(prices):
        print(f"  Storage: {sid}")
        for cid in ["sealed", "mint", "verygood", "good", "fair", "broken"]:
            if cid in prices[sid]:
                print(f"    {cid:10s} ${prices[sid][cid]}")
        print()

def show_history(device_id):
    """Show price history for a device."""
    history = load_history()
    if device_id not in history:
        print(f"No history for '{device_id}'")
        return

    entries = history[device_id]
    print(f"\n=== Price History: {device_id} ({len(entries)} snapshots) ===\n")
    for entry in entries[-10:]:  # last 10
        ts = entry["ts"]
        prices = entry["prices"]
        # Show mint price for first storage
        first_storage = sorted(prices.keys())[0] if prices else "?"
        mint = prices.get(first_storage, {}).get("mint", "?")
        print(f"  {ts}  mint({first_storage})=${mint}")

def export_csv():
    """Export all pricing to CSV."""
    db = load_db()
    outfile = os.path.join(DB_DIR, "prices-export.csv")

    with open(outfile, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["device_id", "label", "storage", "sealed", "mint", "verygood", "good", "fair", "broken", "updated"])

        for did in sorted(db):
            info = db[did]
            label = info.get("label", did)
            for sid in sorted(info.get("prices", {})):
                conds = info["prices"][sid]
                w.writerow([
                    did, label, sid,
                    conds.get("sealed", ""), conds.get("mint", ""),
                    conds.get("verygood", ""), conds.get("good", ""),
                    conds.get("fair", ""), conds.get("broken", ""),
                    info.get("updated", ""),
                ])

    print(f"Exported to {outfile}")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

    if cmd == "save":
        save_snapshot()
    elif cmd == "status":
        show_status()
    elif cmd == "search":
        search(" ".join(sys.argv[2:]))
    elif cmd == "lookup":
        lookup(sys.argv[2] if len(sys.argv) > 2 else "")
    elif cmd == "history":
        show_history(sys.argv[2] if len(sys.argv) > 2 else "")
    elif cmd == "export":
        export_csv()
    else:
        print("""
Price Tracker — local reference for all device pricing

  python3 price-tracker.py save              # Save current site prices locally
  python3 price-tracker.py status            # Overview of all data
  python3 price-tracker.py search "iPhone"   # Search by name
  python3 price-tracker.py lookup ip16pm     # Lookup by ID
  python3 price-tracker.py history ip16pm    # Price change history
  python3 price-tracker.py export            # Export to CSV

Data stored in: price-data/
""")
