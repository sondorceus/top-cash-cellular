#!/usr/bin/env python3
"""Validate scraped price data before loading into the site.
Checks: condition ordering, negative prices, zero prices, outliers."""
import json, sys

def validate(prices_file):
    data = json.load(open(prices_file))
    issues = []
    stats = {"devices": 0, "combos": 0}

    for key, entry in data.items():
        if "prices" not in entry or not entry["prices"]:
            continue
        stats["devices"] += 1

        for sid, conds in entry["prices"].items():
            if not isinstance(conds, dict) or not conds:
                continue

            # Check condition ordering: sealed > mint > verygood > good > fair > broken
            order = ["sealed", "mint", "verygood", "good", "fair", "broken"]
            prev_price, prev_cond = 999999, None
            for c in order:
                if c in conds:
                    p = conds[c]
                    stats["combos"] += 1
                    if p < 0:
                        issues.append(f"NEGATIVE: {key} {sid} {c}=${p}")
                    if p == 0:
                        issues.append(f"ZERO: {key} {sid} {c}=$0")
                    if p > prev_price + 5 and prev_cond:  # 5$ tolerance
                        issues.append(f"ORDER: {key} {sid} {c}=${p} > {prev_cond}=${prev_price}")
                    prev_price, prev_cond = p, c

            # Check sealed isn't absurdly higher than mint (>50% premium = suspicious)
            if "sealed" in conds and "mint" in conds:
                ratio = conds["sealed"] / conds["mint"] if conds["mint"] > 0 else 99
                if ratio > 1.5:
                    issues.append(f"SEALED_HIGH: {key} {sid} sealed=${conds['sealed']} vs mint=${conds['mint']} ({ratio:.1f}x)")

    print(f"Validated {stats['devices']} devices, {stats['combos']} price combos")
    if issues:
        print(f"\n{len(issues)} issues found:")
        for i in issues:
            print(f"  {i}")
        return False
    else:
        print("All prices valid!")
        return True

if __name__ == "__main__":
    f = sys.argv[1] if len(sys.argv) > 1 else "/Users/sonnyd/Desktop/top-cash-cellular/iwm-all-prices.json"
    ok = validate(f)
    sys.exit(0 if ok else 1)
