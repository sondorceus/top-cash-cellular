#!/usr/bin/env python3
"""Scrape IWM device prices directly from the page HEAD (no browser).

Discovery: IWM embeds the full per-model price matrix as a long base64
string assigned to a JS variable on the rendered HTML — no XHR, no API,
no quiz walk needed. The blob is the largest base64 string > 50KB on the
page; decoding yields a JSON tree of:
    [
      {name: 'Models', questions: [{answers: [...models...]}]},
      {name: '2. Quest 2', questions: [
          {text: 'storage', answers: [{text: '64GB', value_current: 20}, ...]},
          {text: 'condition', answers: [{text: 'Flawless', value_current: 0}, ...]},
          ...
      ]},
      ...
    ]

For a given (model, storage, condition), the IWM payout =
    sum(answer.value_current for chosen answer in each question).

Usage:
    python3 iwm-head-scrape.py <iwm-product-url>
        # prints full storage × condition grid per model

    python3 iwm-head-scrape.py <url> --json
        # emits structured JSON for programmatic use
"""
import sys, re, base64, json, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
OUR_MULT = 0.90  # Skywalker directive: pay 10% less than IWM


def fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} — {url}")
        return ""
    except Exception as e:
        print(f"  ERROR {e!r} — {url}")
        return ""


def extract_quiz_blob(html: str):
    """Find the largest base64 blob in the HTML that decodes to the
    questions-tree JSON. Returns the decoded JSON or None."""
    candidates = re.findall(r'"([A-Za-z0-9+/=]{500,})"', html)
    best = None
    for s in candidates:
        try:
            decoded = base64.b64decode(s).decode("utf-8", errors="replace")
            data = json.loads(decoded)
            # The quiz blob is a list of dicts with a 'questions' key
            if isinstance(data, list) and any(isinstance(e, dict) and "questions" in e for e in data):
                if best is None or len(decoded) > len(best[1]):
                    best = (data, decoded)
        except Exception:
            continue
    return best[0] if best else None


def grid_per_model(quiz):
    """Return {model_label: {storage_label: {condition_label: iwm_price}}}.
    First entry in the quiz is the model picker, rest are per-model branches.
    SUMS the MAX value_current from every other question (processor, RAM,
    GPU, secondary drive, accessories...) so the reported price reflects
    a TOP-configured device at the chosen storage + condition."""
    out = {}
    for entry in quiz[1:]:  # skip the "Models" picker
        raw_name = entry.get("name", "?")
        # Skip metadata-only entries (Brand New Terms, etc.)
        if raw_name.lower().endswith("terms"):
            continue
        # Strip leading "2. " / "Draft. 4. " prefixes
        name = re.sub(r'^(Draft\.\s*)?\d+\.\s*', '', raw_name)
        questions = entry.get("questions", [])
        storage_q = next((q for q in questions if "storage" in (q.get("text") or "").lower() and "secondary" not in (q.get("text") or "").lower()), None)
        cond_q = next((q for q in questions if "condition" in (q.get("text") or "").lower()), None)
        # Anything else (processor, RAM, GPU, secondary, accessories, etc.)
        # contributes its MAX value_current as part of the top-config base.
        extras_max = 0
        for q in questions:
            text = (q.get("text") or "").lower()
            if "storage" in text and "secondary" not in text: continue
            if "condition" in text: continue
            answers = q.get("answers", [])
            vals = [a.get("value_current") or 0 for a in answers]
            if vals:
                extras_max += max(vals)
        storages = [(a["text"], a.get("value_current") or 0) for a in (storage_q["answers"] if storage_q else [{"text": "-", "value_current": 0}])]
        conds = [(a["text"], a.get("value_current") or 0) for a in (cond_q["answers"] if cond_q else [])]
        out[name] = {}
        for s_lbl, s_val in storages:
            out[name][s_lbl] = {}
            for c_lbl, c_val in conds:
                out[name][s_lbl][c_lbl] = s_val + c_val + extras_max
    return out


def main():
    args = sys.argv[1:]
    if not args:
        print("usage: iwm-head-scrape.py <url> [--json]")
        sys.exit(1)
    url = args[0]
    want_json = "--json" in args
    html = fetch_html(url)
    if not html:
        sys.exit(2)
    quiz = extract_quiz_blob(html)
    if not quiz:
        print(f"No quiz blob found on {url}")
        sys.exit(2)
    grid = grid_per_model(quiz)
    if want_json:
        print(json.dumps(grid, indent=2))
        return
    print(f"=== IWM grid for {url} ===")
    print(f"{'Model':32s} {'Storage':12s} {'Condition':12s} {'IWM':<8s} {'Ours×0.9':<10s}")
    print("-" * 80)
    for model, storages in grid.items():
        for storage, conds in storages.items():
            for cond, iwm in conds.items():
                ours = round(iwm * OUR_MULT)
                print(f"  {model:30s} {storage:12s} {cond:12s} ${iwm:<6d} ${ours:<6d}")
        print()


if __name__ == "__main__":
    main()
