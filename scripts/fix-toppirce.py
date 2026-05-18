#!/usr/bin/env python3
"""Audit + fix topPrice values on every series/sub-series entry in
page.tsx. Computes the true max from the referenced _VARIANTS array
and updates the entry in place.

Also strips `inquiryOnly: true` from any series/sub-series entry that
now has topPrice > 0 — the picker should show "Up to $X" not "Get
an offer" / inquiry-only when variants underneath are priced.
"""
from __future__ import annotations
import re
from pathlib import Path

PAGE = Path(__file__).parent.parent / "app" / "page.tsx"


def main():
    src = PAGE.read_text(encoding="utf-8")

    def max_base_for_array(name: str) -> int:
        start = src.find(f"const {name} = [")
        if start < 0:
            return 0
        end = src.find("];", start)
        body = src[start:end]
        bases = [int(m.group(1)) for m in re.finditer(r"base:\s*(\d+)", body)]
        return max(bases) if bases else 0

    # Resolve a SUB_SERIES array → max of all referenced *_VARIANTS arrays
    def max_for_sub_series_array(name: str) -> int:
        start = src.find(f"const {name} = [")
        if start < 0:
            return 0
        end = src.find("];", start)
        body = src[start:end]
        inner = re.findall(r"variants:\s*(\w+_VARIANTS)", body)
        return max((max_base_for_array(a) for a in inner), default=0)

    # Find every entry with topPrice + (variants or subSeries)
    entry_re = re.compile(
        r'(\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)"[^}]*?)'
        r'(topPrice:\s*(\d+))'
        r'([^}]*?(?:variants|subSeries):\s*(\w+))'
        r"([^}]*\})"
    )

    edits = []
    for m in entry_re.finditer(src):
        full, eid, label, topfield, topval, mid, arr, tail = (
            m.group(1) + m.group(4) + m.group(6) + m.group(7),
            m.group(2), m.group(3), m.group(4), int(m.group(5)),
            m.group(6), m.group(7), m.group(8) if m.lastindex >= 8 else "",
        )
        # Compute actual max
        if "SUB_SERIES" in arr:
            actual = max_for_sub_series_array(arr)
        else:
            actual = max_base_for_array(arr)
        if actual <= 0 or actual == topval:
            continue
        # Build new full string with updated topPrice
        new_field = f"topPrice: {actual}"
        old_full = m.group(0)
        # Replace topPrice value
        new_full = old_full.replace(topfield, new_field, 1)
        # Strip inquiryOnly: true if present (since we now have a price)
        new_full = re.sub(r",\s*inquiryOnly:\s*true", "", new_full)
        edits.append((m.start(), m.end(), new_full, eid, topval, actual))

    if not edits:
        print("No mismatches found.")
        return

    # Apply in reverse to preserve offsets
    new_src = src
    edits.sort(key=lambda e: -e[0])
    for start, end, replacement, eid, oldtop, newtop in edits:
        new_src = new_src[:start] + replacement + new_src[end:]
    PAGE.write_text(new_src, encoding="utf-8")
    print(f"Fixed {len(edits)} series/sub-series entries:")
    for start, end, replacement, eid, oldtop, newtop in sorted(edits, key=lambda e: e[3]):
        change = f"${oldtop}->${newtop}"
        print(f"  {eid:35s} {change}")


if __name__ == "__main__":
    main()
