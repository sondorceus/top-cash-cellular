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


def _cur(a):
    """An answer's current payout value. IWM uses `value_current`; fall back
    to `value` when the dated field is absent."""
    v = a.get("value_current")
    return v if isinstance(v, (int, float)) else (a.get("value") or 0)


def _model_name_from_url(url: str) -> str:
    slug = url.rstrip("/").split("/")[-1]
    # "iphone-16-pro" -> "Iphone 16 Pro"; good enough as a programmatic key.
    return slug.replace("-", " ").strip().title() or slug


def grid_new_format(quiz, url: str):
    """New IWM layout (changed ~2026): one PAGE == one model. quiz[0] is a
    'Conditions' picker whose answers carry the BASE payout per grade (at the
    cheapest storage, unlocked) plus a `go_to` pointing at a branch; the
    branches (quiz[1:]) carry the per-storage DELTAS plus carrier / unlock /
    operational / accessory adjustments.

    Clean unlocked-working comp = base + storage_delta (carrier/unlock/
    operational all 0 for an unlocked, fully-operational device). Returns
    {model: {storage_label: {condition_label: iwm_price}}} to match the
    legacy shape."""
    cond_q = next((q for q in quiz[0].get("questions", [])
                   if "condition" in (q.get("text") or "").lower()), None)
    if not cond_q:
        return None
    # Index branches by their leading number ("3. Excellent/..." -> "3"),
    # which is the first token of an answer's go_to ("3,1" -> "3").
    branches = {}
    for e in quiz[1:]:
        mm = re.match(r"\s*(\d+)\.", e.get("name", ""))
        if mm:
            branches[mm.group(1)] = e

    def storage_deltas(branch):
        for q in branch.get("questions", []):
            t = (q.get("text") or "").lower()
            if "storage" in t and "secondary" not in t:
                return [(a["text"], _cur(a)) for a in q.get("answers", [])]
        return [("-", 0)]

    model = _model_name_from_url(url)
    grid = {}
    for a in cond_q.get("answers", []):
        base = _cur(a)
        branch = branches.get(str(a.get("go_to", "")).split(",")[0].strip())
        if not branch:
            continue
        for s_lbl, s_delta in storage_deltas(branch):
            grid.setdefault(s_lbl, {})[a["text"]] = base + s_delta
    return {model: grid} if grid else None


def grid_per_model(quiz):
    """LEGACY IWM layout: quiz[0] is a model picker, quiz[1:] are per-model
    branches each carrying their own storage + condition questions. Kept as a
    fallback for any page still serving the old shape.

    Return {model_label: {storage_label: {condition_label: iwm_price}}}.
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
    # Detect layout: new format leads with a 'Conditions' picker; legacy leads
    # with a 'Models' picker. Try new first, fall back to legacy.
    q0_text = ((quiz[0].get("questions") or [{}])[0].get("text") or "").lower()
    grid = grid_new_format(quiz, url) if "condition" in q0_text else None
    if not grid:
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
