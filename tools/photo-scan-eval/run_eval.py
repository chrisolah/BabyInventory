#!/usr/bin/env python3
"""
run_eval.py — Score the photo-scan extractor on a labeled image set.

Why this exists
---------------
We can't fine-tune the hosted Haiku model. The only dials we have are
(1) the prompt and (2) the post-processing in the Edge Function. To
iterate those responsibly we need numbers, not vibes. This harness:

  - posts every image in a folder to the model,
  - compares the returned fields against a ground-truth CSV,
  - writes a per-row results CSV and a summary report.

Two backends
------------
  --via anthropic  (default) — calls the Anthropic API directly using the
                   prompt defined below. Fastest path to iterate, because
                   it skips auth + rate limiting + Supabase runtime. The
                   prompt MUST stay in sync with the Edge Function's
                   SYSTEM_PROMPT (supabase/functions/scan-clothing-tag).

  --via edge      — calls the deployed or local Edge Function with a JWT.
                   Use this only when verifying end-to-end. Requires
                   SCAN_EDGE_URL and SCAN_JWT env vars.

CSV contract
------------
Ground truth CSV must contain at minimum:
    filename,brand,size,category,item_type
Optional:
    tag_visibility — one of "visible" (default), "partial", "none".
        "visible" = tag fills a good chunk of frame; model should read brand/size.
        "partial" = tag in frame but small or obscured; either behavior fine.
        "none"    = no tag in frame (parent photographed the whole garment).
                    For this row, brand/size null predictions are graded as
                    correct — the model can't read what isn't there. Category
                    and item_type are still graded normally.
Extra columns are ignored. `brand` may be empty string for null-brand
cases; `size`/`category`/`item_type` should be canonical enum values.

Usage
-----
    # Generate synthetic set first:
    python3 synth_tags.py --out ./synth --count 60

    # Then score it:
    python3 run_eval.py --images ./synth/images \\
                        --ground-truth ./synth/ground_truth.csv \\
                        --out ./synth/results \\
                        --via anthropic

Env
---
    ANTHROPIC_API_KEY     required for --via anthropic
    ANTHROPIC_MODEL       defaults to claude-haiku-4-5-20251001
    SCAN_EDGE_URL         required for --via edge (full URL to Edge Function)
    SCAN_JWT              required for --via edge (bearer token for a logged-in user)
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import urllib.request
import urllib.error


# ── Enum pools (keep in sync with the Edge Function) ────────────────────────
SIZES = ['0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M']
CATEGORIES = [
    'tops_and_bodysuits', 'one_pieces', 'bottoms', 'dresses_and_skirts',
    'outerwear', 'sleepwear', 'footwear', 'accessories', 'swimwear',
]
SLOT_IDS = [
    'bodysuits', 'day_tops', 'one_pieces', 'shorts', 'pants_leggings',
    'dresses', 'sleep_sacks', 'pajamas', 'rain_gear', 'jackets',
    'socks', 'shoes', 'hats', 'mittens', 'bibs', 'burp_cloths', 'swimwear',
]

# ── Prompt — keep in sync with supabase/functions/scan-clothing-tag/index.ts ─
_QUOTED_SIZES      = ', '.join('"' + s + '"' for s in SIZES)
_QUOTED_CATEGORIES = ', '.join('"' + c + '"' for c in CATEGORIES)
_QUOTED_SLOT_IDS   = ', '.join('"' + s + '"' for s in SLOT_IDS)

SYSTEM_PROMPT = (
    "You are extracting structured inventory fields from a photo of a baby "
    "clothing item or its tag.\n\n"
    "Return ONLY a single JSON object with these keys:\n"
    "- brand: the brand name as printed on the tag, or null if you cannot "
    "read one. Do not invent brands.\n"
    f"- size_label: one of {_QUOTED_SIZES}, mapped from what the tag says "
    "(e.g. \"3M\" or \"3 months\" → \"0-3M\"; \"6M\" or \"6 months\" → "
    "\"3-6M\"; \"9M\" or \"9 months\" → \"6-9M\"; \"12M\" or \"12 months\" → "
    "\"9-12M\"; \"18M\" → \"12-18M\"; \"24M\" or \"2T\" → \"18-24M\"). If "
    "the tag shows a range that spans two bands, pick the lower one. Use "
    "null if no size is readable.\n"
    f"- category: one of {_QUOTED_CATEGORIES}, inferred from the garment "
    "visible in the image. Use null if you can't tell.\n"
    f"- item_type: one of {_QUOTED_SLOT_IDS}, the most specific slot that "
    "fits. Must be consistent with the chosen category. Use null if unsure.\n\n"
    "Descriptor hints for baby clothing terminology (these words are used "
    "colloquially in infant apparel, not literally):\n"
    "- \"ONESIE\" or \"BODYSUIT\" → category \"tops_and_bodysuits\", "
    "item_type \"bodysuits\". A onesie in baby clothing is a snap-crotch "
    "short-sleeve top, not a full-body one-piece.\n"
    "- \"COVERALL\" or \"ROMPER\" → category \"one_pieces\", item_type "
    "\"one_pieces\". A baby coverall is a romper-style one-piece garment, "
    "not adult workwear or rain-gear.\n"
    "- \"SLEEPER\" or \"PAJAMAS\" → category \"sleepwear\", item_type "
    "\"pajamas\".\n"
    "- \"BOOTIES\" → category \"footwear\", item_type \"shoes\".\n"
    "- \"SOCKS\" → category \"footwear\", item_type \"socks\". Socks "
    "belong in footwear in this taxonomy, not accessories — accessories "
    "is reserved for hats, mittens, bibs, and burp cloths.\n\n"
    "Do not include any prose, markdown, or code fences. Return the JSON "
    "object and nothing else. Prefer null over a low-confidence guess."
)

USER_TEXT = "Extract the fields per the system instructions. Return JSON only."


# ── MIME detection ──────────────────────────────────────────────────────────
def detect_mime(path: Path) -> Optional[str]:
    ext = path.suffix.lower()
    if ext in ('.jpg', '.jpeg'): return 'image/jpeg'
    if ext == '.png':            return 'image/png'
    if ext == '.webp':           return 'image/webp'
    return None


# ── Backends ────────────────────────────────────────────────────────────────
@dataclass
class RawResponse:
    fields: dict
    latency_ms: int
    error: Optional[str] = None
    raw_text: str = ''


def _http_post_json(url: str, headers: dict, body: dict, timeout: int = 60) -> tuple[int, dict, str]:
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8')
            try:
                return resp.status, json.loads(raw), raw
            except json.JSONDecodeError:
                return resp.status, {}, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', errors='replace')
        try:
            return e.code, json.loads(raw), raw
        except json.JSONDecodeError:
            return e.code, {}, raw


def call_anthropic(image_b64: str, mime: str) -> RawResponse:
    """Direct call to the Anthropic Messages API."""
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key:
        return RawResponse(fields={}, latency_ms=0, error='ANTHROPIC_API_KEY not set')

    model = os.environ.get('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001')
    body = {
        'model': model,
        'max_tokens': 400,
        'system': SYSTEM_PROMPT,
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'image', 'source': {'type': 'base64', 'media_type': mime, 'data': image_b64}},
                {'type': 'text', 'text': USER_TEXT},
            ],
        }],
    }
    headers = {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
    }

    t0 = time.time()
    status, parsed, raw = _http_post_json('https://api.anthropic.com/v1/messages', headers, body)
    latency_ms = int((time.time() - t0) * 1000)

    if status != 200:
        return RawResponse(fields={}, latency_ms=latency_ms, error=f'http_{status}', raw_text=raw[:500])

    text = ''
    try:
        text = parsed.get('content', [{}])[0].get('text', '')
    except Exception:
        pass

    fields = _extract_json(text)
    if fields is None:
        return RawResponse(fields={}, latency_ms=latency_ms, error='bad_json', raw_text=text[:500])

    return RawResponse(fields=_coerce_fields(fields), latency_ms=latency_ms, raw_text=text[:500])


def call_edge(image_b64: str, mime: str) -> RawResponse:
    """Call the Edge Function. Requires SCAN_EDGE_URL + SCAN_JWT."""
    url = os.environ.get('SCAN_EDGE_URL')
    jwt = os.environ.get('SCAN_JWT')
    if not url or not jwt:
        return RawResponse(fields={}, latency_ms=0, error='SCAN_EDGE_URL / SCAN_JWT not set')

    body = {'image_base64': image_b64, 'mime_type': mime}
    headers = {
        'content-type': 'application/json',
        'authorization': f'Bearer {jwt}',
    }

    t0 = time.time()
    status, parsed, raw = _http_post_json(url, headers, body)
    latency_ms = int((time.time() - t0) * 1000)

    if status != 200:
        return RawResponse(
            fields={}, latency_ms=latency_ms,
            error=f'http_{status}:{parsed.get("error", "")}', raw_text=raw[:500],
        )

    return RawResponse(
        fields=_coerce_fields(parsed.get('fields', {})),
        latency_ms=latency_ms,
        raw_text=json.dumps(parsed.get('raw', {}))[:500],
    )


def _extract_json(text: str) -> Optional[dict]:
    t = text.strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    s = t.find('{')
    e = t.rfind('}')
    if s == -1 or e == -1 or e < s:
        return None
    try:
        return json.loads(t[s:e + 1])
    except json.JSONDecodeError:
        return None


def _coerce_fields(raw: dict) -> dict:
    """Mirror the Edge Function's coerceFields so both backends score the same."""
    def _str(v, allowed=None, max_len=80):
        if not isinstance(v, str) or not v.strip():
            return None
        s = v.strip()[:max_len]
        if allowed is not None and s not in allowed:
            return None
        return s
    return {
        'brand':      _str(raw.get('brand')),
        'size_label': _str(raw.get('size_label'), allowed=set(SIZES)),
        'category':   _str(raw.get('category'),   allowed=set(CATEGORIES)),
        'item_type':  _str(raw.get('item_type'),  allowed=set(SLOT_IDS)),
    }


# ── Scoring ─────────────────────────────────────────────────────────────────

def normalize_brand(s: str) -> str:
    """Case-insensitive, apostrophe-insensitive compare."""
    if not s:
        return ''
    return (
        s.lower()
         .replace("'", "'")
         .replace('’', "'")
         .replace("'", '')
         .replace('-', '')
         .replace(' ', '')
    )


@dataclass
class Row:
    filename: str
    tag_visibility: str   # 'visible' | 'partial' | 'none'
    gt_brand: str
    gt_size: str
    gt_category: str
    gt_item_type: str
    pred_brand: Optional[str]
    pred_size: Optional[str]
    pred_category: Optional[str]
    pred_item_type: Optional[str]
    brand_ok: bool
    size_ok: bool
    category_ok: bool
    item_type_ok: bool
    error: Optional[str]
    latency_ms: int


VALID_VISIBILITY = ('visible', 'partial', 'none')


def _normalize_visibility(raw: str) -> str:
    v = (raw or '').strip().lower()
    if v in VALID_VISIBILITY:
        return v
    # Default: synth CSVs have no column, pilot rows missing the value —
    # treat those as 'visible' (the strict case). Unknown string values are
    # also coerced to 'visible' so bad data fails loud in the normal table.
    return 'visible'


def score_row(gt: dict, pred: dict, tag_visibility: str = 'visible') -> dict:
    gt_brand_norm   = normalize_brand(gt.get('brand', '') or '')
    pred_brand_norm = normalize_brand(pred.get('brand', '') or '')
    pred_brand_is_null = pred.get('brand') in (None, '')
    pred_size_is_null  = pred.get('size_label') in (None, '')

    # Brand matching. For 'none' visibility, pred=null is always correct (the
    # model can't read a tag that isn't there; the user will fill it in
    # manually). A non-null pred still has to match GT — that's the
    # hallucination case we explicitly want to catch.
    if gt_brand_norm == '':
        # GT has no brand — we always want pred to be null.
        brand_ok = pred_brand_is_null
    elif tag_visibility == 'none' and pred_brand_is_null:
        # Tag not in frame, model said null → exactly what we want.
        brand_ok = True
    else:
        # Accept exact match OR substring in either direction (min 2 chars) so
        # "H&M" counts as a match for "H&M Baby" and vice versa. Brand families
        # frequently truncate the sub-line name on tags, and a user seeing
        # "H&M" in the prefill will recognize it as the same brand.
        brand_ok = (
            bool(pred_brand_norm)
            and len(pred_brand_norm) >= 2
            and (
                pred_brand_norm == gt_brand_norm
                or pred_brand_norm in gt_brand_norm
                or gt_brand_norm in pred_brand_norm
            )
        )

    # Size matching. Same rule: for 'none', null pred is correct; a wrong
    # non-null pred is still a miss.
    gt_size  = (gt.get('size', '') or '')
    if tag_visibility == 'none' and pred_size_is_null:
        size_ok = True
    else:
        size_ok = (pred.get('size_label') or '') == gt_size

    # Category and item_type are inferable from the garment itself, so we
    # grade them identically regardless of tag_visibility. The whole point
    # of supporting garment-only photos is that these two fields should
    # still come through.
    category_ok = (pred.get('category')   or '') == (gt.get('category', '') or '')
    item_ok     = (pred.get('item_type')  or '') == (gt.get('item_type','') or '')
    return {
        'brand_ok':     brand_ok,
        'size_ok':      size_ok,
        'category_ok':  category_ok,
        'item_type_ok': item_ok,
    }


# ── Report ──────────────────────────────────────────────────────────────────

def _pct(n: int, d: int) -> str:
    return f'{(n / d * 100):.1f}%' if d else 'n/a'


def build_report(rows: list[Row], backend: str, model: str) -> str:
    n = len(rows)
    scored = [r for r in rows if r.error is None]
    errored = [r for r in rows if r.error is not None]
    ns = len(scored)

    if ns == 0:
        return (
            f'# Photo-scan eval report\n\n'
            f'Backend: **{backend}**  Model: **{model}**  Images: {n}\n\n'
            f'**All {n} requests errored.** Check the results CSV.\n'
        )

    brand_hits = sum(r.brand_ok for r in scored)
    size_hits  = sum(r.size_ok  for r in scored)
    cat_hits   = sum(r.category_ok for r in scored)
    item_hits  = sum(r.item_type_ok for r in scored)
    all_hits   = sum(
        r.brand_ok and r.size_ok and r.category_ok and r.item_type_ok
        for r in scored
    )

    # Confidently wrong vs. said null — only meaningful when GT has a real value.
    # "Said null" = returned null on something that has an answer. Not great,
    # but MUCH less bad than returning a wrong answer.
    def split_wrong(field_gt: str, field_pred: str):
        null_calls = 0
        wrong_calls = 0
        for r in scored:
            gt_val   = getattr(r, f'gt_{field_gt}')
            pred_val = getattr(r, f'pred_{field_pred}')
            if not gt_val:
                continue  # null GT — skip
            ok = getattr(r, f'{field_gt if field_gt != "brand" else "brand"}_ok')
            if ok:
                continue
            if pred_val in (None, ''):
                null_calls += 1
            else:
                wrong_calls += 1
        return null_calls, wrong_calls

    brand_null, brand_wrong = split_wrong('brand', 'brand')
    size_null,  size_wrong  = split_wrong('size',  'size')
    cat_null,   cat_wrong   = split_wrong('category', 'category')
    item_null,  item_wrong  = split_wrong('item_type', 'item_type')

    # Size confusion matrix (pred -> truth)
    size_confusion = Counter()
    for r in scored:
        if r.gt_size and not r.size_ok:
            size_confusion[(r.gt_size, r.pred_size or 'null')] += 1
    top_confusions = size_confusion.most_common(8)

    # Latency
    latencies = [r.latency_ms for r in scored]
    lat_avg = sum(latencies) // len(latencies)
    lat_max = max(latencies)

    lines = []
    lines.append('# Photo-scan eval report')
    lines.append('')
    lines.append(f'Backend: **{backend}**  Model: **{model}**')
    lines.append(f'Images: {n} ({ns} scored, {len(errored)} errored)')
    lines.append(f'Latency: avg {lat_avg} ms, max {lat_max} ms')
    lines.append('')
    lines.append('## Per-field accuracy')
    lines.append('')
    lines.append('| Field      | Correct | Rate   | "Said null" | "Confidently wrong" |')
    lines.append('|------------|---------|--------|-------------|---------------------|')
    lines.append(f'| brand      | {brand_hits}/{ns} | {_pct(brand_hits, ns)} | {brand_null} | {brand_wrong} |')
    lines.append(f'| size       | {size_hits}/{ns}  | {_pct(size_hits,  ns)} | {size_null}  | {size_wrong}  |')
    lines.append(f'| category   | {cat_hits}/{ns}   | {_pct(cat_hits,   ns)} | {cat_null}   | {cat_wrong}   |')
    lines.append(f'| item_type  | {item_hits}/{ns}  | {_pct(item_hits,  ns)} | {item_null}  | {item_wrong}  |')
    lines.append(f'| **all 4**  | {all_hits}/{ns}   | {_pct(all_hits,   ns)} | —            | —             |')
    lines.append('')
    lines.append('Reading this table: "Said null" is the model being honest about '
                 "not knowing — that's fine, the UI just won't prefill that field. "
                 '"Confidently wrong" is the model hallucinating an answer that '
                 'will silently land in the user\'s inventory. That\'s the bad '
                 'failure mode and the number we most want to drive down.')
    lines.append('')

    # Stratified accuracy by tag_visibility. Only emit this section if the
    # ground truth actually uses the column (i.e. there's more than one
    # visibility bucket, or the single bucket is non-default). For
    # tag-only synthetic sets this stays silent; for pilot sets with a mix
    # of tag-visible / partial / garment-only it shows where the feature
    # holds up.
    by_vis = defaultdict(list)
    for r in scored:
        by_vis[r.tag_visibility].append(r)
    show_stratified = len(by_vis) > 1 or any(k != 'visible' for k in by_vis)
    if show_stratified:
        lines.append('## Accuracy by tag visibility')
        lines.append('')
        lines.append('This splits the result by how much of the tag was in frame. For '
                     '`none` rows (garment-only photos), a null brand/size prediction '
                     'is graded as **correct** — the model cannot read a tag that '
                     "isn't there, and the user fills those fields in manually. Any "
                     'non-null brand on a `none` row that doesn\'t match GT is a '
                     'hallucination — that\'s what the "confidently wrong" column '
                     'tracks here.')
        lines.append('')
        lines.append('| Visibility | n | All-4 | brand | size | category | item_type | brand_hallucinated |')
        lines.append('|------------|---|-------|-------|------|----------|-----------|--------------------|')
        for vis in ('visible', 'partial', 'none'):
            sub = by_vis.get(vis, [])
            if not sub:
                continue
            nn = len(sub)
            b = sum(r.brand_ok     for r in sub)
            s = sum(r.size_ok      for r in sub)
            c = sum(r.category_ok  for r in sub)
            i = sum(r.item_type_ok for r in sub)
            a = sum(r.brand_ok and r.size_ok and r.category_ok and r.item_type_ok for r in sub)
            # Brand hallucination: pred non-null AND brand_ok is False.
            # Meaningful across all visibility buckets, but especially for
            # 'none' — that's a confident wrong answer on a field the model
            # couldn't legitimately see.
            halluc = sum(1 for r in sub
                         if (not r.brand_ok) and (r.pred_brand not in (None, '')))
            lines.append(
                f'| {vis:10} | {nn} | {a}/{nn} ({_pct(a, nn)}) | '
                f'{_pct(b, nn)} | {_pct(s, nn)} | '
                f'{_pct(c, nn)} | {_pct(i, nn)} | {halluc} |'
            )
        lines.append('')

    if top_confusions:
        lines.append('## Top size confusions')
        lines.append('')
        lines.append('| Truth | Predicted | Count |')
        lines.append('|-------|-----------|-------|')
        for (truth, predicted), count in top_confusions:
            lines.append(f'| {truth} | {predicted} | {count} |')
        lines.append('')
        lines.append('Adjacent-band confusions (e.g. 3-6M predicted as 0-3M) are usually '
                     "normalization failures in the prompt's size-mapping examples; "
                     'non-adjacent confusions suggest the model isn\'t reading the tag cleanly.')
        lines.append('')

    # Per-tag-style breakdown if we have it
    # (tag_style is in ground truth for synthetic sets)
    # We don't carry it into Row, so just count errors by filename suffix.
    by_style = defaultdict(lambda: {'n': 0, 'ok': 0})
    for r in scored:
        style = 'hangtag' if 'hangtag' in r.filename else ('care_label' if 'care_label' in r.filename else 'other')
        by_style[style]['n']  += 1
        if r.brand_ok and r.size_ok and r.category_ok and r.item_type_ok:
            by_style[style]['ok'] += 1
    if any(k != 'other' for k in by_style):
        lines.append('## By tag style (synthetic sets only)')
        lines.append('')
        lines.append('| Style      | All-4 accuracy |')
        lines.append('|------------|----------------|')
        for style in sorted(by_style):
            if style == 'other':
                continue
            v = by_style[style]
            lines.append(f'| {style:10} | {v["ok"]}/{v["n"]} ({_pct(v["ok"], v["n"])}) |')
        lines.append('')

    if errored:
        lines.append('## Errors')
        lines.append('')
        err_counts = Counter(r.error for r in errored)
        for err, count in err_counts.most_common():
            lines.append(f'- `{err}` — {count}')
        lines.append('')

    lines.append('## What to look at next')
    lines.append('')
    lines.append('1. If size accuracy is low, look at the top-confusions table. '
                 'Add failing examples to the SYSTEM_PROMPT size-mapping list.')
    lines.append('2. If "confidently wrong" > 0 on brand, the model is hallucinating. '
                 'Tighten the "Do not invent brands" language and add a counter-example.')
    lines.append('3. If category/item_type accuracy drops together, the model is losing '
                 "the garment context. Consider making the descriptor mapping part of the "
                 'prompt (e.g. "BODYSUIT → tops_and_bodysuits/bodysuits").')
    lines.append('4. If the synthetic set scores much higher than the pilot set, the '
                 'synthetic generator is too easy — start varying rotation, blur, and '
                 'lighting more aggressively.')
    return '\n'.join(lines)


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--images', required=True, help='Directory of image files')
    ap.add_argument('--ground-truth', required=True, help='Ground truth CSV')
    ap.add_argument('--out', default='./results', help='Output directory')
    ap.add_argument('--via', choices=['anthropic', 'edge'], default='anthropic')
    ap.add_argument('--limit', type=int, default=0, help='Max images to score (0 = all)')
    ap.add_argument('--skip',  type=int, default=0, help='Skip first N ground-truth rows (for batching)')
    ap.add_argument('--sleep-ms', type=int, default=0, help='Sleep between calls (rate-limit friendly)')
    args = ap.parse_args()

    img_dir = Path(args.images)
    gt_path = Path(args.ground_truth)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    if not img_dir.is_dir():
        print(f'error: --images {img_dir} is not a directory', file=sys.stderr)
        sys.exit(2)
    if not gt_path.is_file():
        print(f'error: --ground-truth {gt_path} not found', file=sys.stderr)
        sys.exit(2)

    with gt_path.open() as f:
        gt_rows = list(csv.DictReader(f))
    if args.skip:
        gt_rows = gt_rows[args.skip:]
    if args.limit:
        gt_rows = gt_rows[:args.limit]

    backend = args.via
    model = os.environ.get('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001')

    results: list[Row] = []
    for i, gt in enumerate(gt_rows):
        filename = gt['filename']
        img_path = img_dir / filename
        if not img_path.is_file():
            print(f'[{i+1}/{len(gt_rows)}] {filename}: missing image, skipping')
            continue

        mime = detect_mime(img_path)
        if mime is None:
            print(f'[{i+1}/{len(gt_rows)}] {filename}: unsupported extension')
            continue

        img_b64 = base64.b64encode(img_path.read_bytes()).decode('ascii')

        if backend == 'anthropic':
            resp = call_anthropic(img_b64, mime)
        else:
            resp = call_edge(img_b64, mime)

        pred = resp.fields or {}
        visibility = _normalize_visibility(gt.get('tag_visibility', '') or '')
        scored = score_row(gt, pred, tag_visibility=visibility)

        row = Row(
            filename       = filename,
            tag_visibility = visibility,
            gt_brand     = gt.get('brand', '')     or '',
            gt_size      = gt.get('size', '')      or '',
            gt_category  = gt.get('category', '')  or '',
            gt_item_type = gt.get('item_type', '') or '',
            pred_brand     = pred.get('brand'),
            pred_size      = pred.get('size_label'),
            pred_category  = pred.get('category'),
            pred_item_type = pred.get('item_type'),
            brand_ok     = scored['brand_ok'],
            size_ok      = scored['size_ok'],
            category_ok  = scored['category_ok'],
            item_type_ok = scored['item_type_ok'],
            error        = resp.error,
            latency_ms   = resp.latency_ms,
        )
        results.append(row)

        status = 'ok' if (row.brand_ok and row.size_ok and row.category_ok and row.item_type_ok) else 'miss'
        if resp.error:
            status = f'ERR {resp.error}'
        print(f'[{i+1}/{len(gt_rows)}] {filename}: {status} ({resp.latency_ms} ms)')

        if args.sleep_ms:
            time.sleep(args.sleep_ms / 1000)

    # Write per-row results CSV
    results_csv = out_dir / 'results.csv'
    with results_csv.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow([
            'filename', 'tag_visibility',
            'gt_brand', 'pred_brand', 'brand_ok',
            'gt_size',  'pred_size',  'size_ok',
            'gt_category',  'pred_category',  'category_ok',
            'gt_item_type', 'pred_item_type', 'item_type_ok',
            'error', 'latency_ms',
        ])
        for r in results:
            w.writerow([
                r.filename, r.tag_visibility,
                r.gt_brand, r.pred_brand or '', r.brand_ok,
                r.gt_size,  r.pred_size  or '', r.size_ok,
                r.gt_category,  r.pred_category  or '', r.category_ok,
                r.gt_item_type, r.pred_item_type or '', r.item_type_ok,
                r.error or '', r.latency_ms,
            ])

    # Write report.md
    report_md = out_dir / 'report.md'
    report_md.write_text(build_report(results, backend, model), encoding='utf-8')

    print()
    print(f'Wrote {results_csv}')
    print(f'Wrote {report_md}')


if __name__ == '__main__':
    main()
