# photo-scan-eval

A small harness for measuring how well the photo-scan feature actually
works. Not a test suite — a loop we run whenever we change the prompt
or the model, so decisions about the extractor are backed by numbers
instead of vibes.

## Why this exists

Haiku-class hosted models can't be fine-tuned. The only dials we have
are the prompt in `supabase/functions/scan-clothing-tag/index.ts` and
the post-processing around it. That means we need a cheap way to:

1. Try a new prompt, see whether it made things better or worse.
2. Spot which failure modes are biggest (size normalization? brand
   hallucination? category confusion?) so we know what to fix first.
3. Tell the difference between "the model said it didn't know" (fine —
   UI just doesn't prefill) and "the model was confidently wrong"
   (bad — wrong data lands in the user's inventory).

The harness takes a folder of images + a ground-truth CSV, calls the
model on each image, and writes a per-row results CSV and a summary
report.

## Two datasets

- **Synthetic** (`synth_tags.py`). Generates baby-clothing hangtags and
  care labels on the fly, with ground truth for free. Big, cheap, but
  easy — these tags are clean PIL renders, not real photographs. Use
  this to catch regressions in size normalization and descriptor→enum
  mapping.
- **Pilot** (your real photos). Fill the template CSV as you go. Small,
  expensive, but real. Use this to see what the model actually does
  on phone photos with bad lighting and curved fabric.

Plan: we build on synthetic, we ship on pilot.

## Setup

Dependencies: Python 3.10+, Pillow.

```bash
pip install Pillow --break-system-packages
```

For `--via anthropic`:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# Optional — defaults to the current Haiku:
export ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

For `--via edge` (end-to-end check against a deployed/local Edge
Function):

```bash
export SCAN_EDGE_URL=https://<project-ref>.functions.supabase.co/scan-clothing-tag
export SCAN_JWT=<bearer token for a logged-in user>
```

Most of the time you'll want `--via anthropic`. The Edge Function just
wraps the same model with auth + rate-limit; skipping it makes
iteration faster and keeps the daily-cap counter unspent.

## Generate a synthetic set

```bash
python3 synth_tags.py --out ./synth --count 60 --seed 42
```

Produces `synth/images/*.png` and `synth/ground_truth.csv`. Different
`--seed` values give a different distribution. `--count 200` is fine;
there's no network cost here.

## Run an eval

```bash
python3 run_eval.py \
  --images ./synth/images \
  --ground-truth ./synth/ground_truth.csv \
  --out ./synth/results \
  --via anthropic
```

Writes:

- `synth/results/results.csv` — one row per image with prediction vs.
  ground truth and whether each field matched.
- `synth/results/report.md` — summary with per-field accuracy, the
  "said null" vs. "confidently wrong" split, top size confusions, and
  a by-tag-style breakdown.

`--limit 5` is useful for smoke tests. `--sleep-ms 200` is useful if
you're hitting rate limits on the shared tier.

## Run on your own photos

1. Drop photos in `pilot/images/`.
2. Copy `pilot_template.csv` → `pilot/ground_truth.csv`, remove the
   comment lines, and fill one row per photo. The `tag_visibility`
   column is the important one here (see below).
3. Run:

   ```bash
   python3 run_eval.py \
     --images ./pilot/images \
     --ground-truth ./pilot/ground_truth.csv \
     --out ./pilot/results \
     --via anthropic
   ```

### About `tag_visibility`

The synthetic set is tag-only by design (a cardboard hangtag or a
sewn-in care label filling the frame). Real parents, the ones we built
this feature for, mostly won't photograph like that — they'll snap the
whole onesie on a changing pad and call it done. `tag_visibility` tells
the harness how much tag was in the shot so it can grade accordingly:

- **visible** — tag fills a good chunk of the frame, brand/size
  readable. Graded strictly: a null pred on brand/size counts as a
  miss, because the model should have read it.
- **partial** — tag is in frame but small, folded, or partly obscured.
  Graded the same as visible; a null pred is "said null" (fine, UI
  just doesn't prefill), a wrong non-null pred is a hallucination.
- **none** — no tag in frame, whole-garment photo. A null pred on
  brand and size is graded as **correct** — the model can't read what
  isn't there, and the user fills those fields in manually. A non-null
  wrong pred is a hallucination and counts as a miss. Category and
  item_type are graded normally — the model should always be able to
  tell a onesie from a pair of pants.

The report adds an "Accuracy by tag visibility" section whenever the
pilot set has more than one visibility bucket, so you can see where
the feature holds up and where it falls off.

### How big to make a pilot set

Twenty labeled photos is enough to tell you whether synthetic results
generalize. Fifty is enough to trust the "confidently wrong" number.
A good mix is roughly **5 visible / 5 partial / 10 garment-only** —
that's the distribution that matches what parents will actually take,
and it's weighted toward `none` because that's the least-tested case.

## Reading the report

Three numbers matter most:

- **All-4 accuracy** — fraction of images where brand, size, category,
  and item_type were all correct. This is the "prefill everything"
  experience the user gets. Anything below ~70% means the feature
  leaves most users editing fields manually.
- **Confidently wrong by field** — the count of hallucinations per
  field. Brand is the scariest one here: a wrong brand is silent, it
  doesn't cause the UI to prompt the user. Drive this toward zero.
- **Top size confusions** — if they're all adjacent-band, the
  size-mapping list in the prompt needs more examples. If they're
  non-adjacent, the model isn't reading the tag cleanly and more
  prompt hints won't save you.

## Prompt iteration loop

1. Note baseline numbers.
2. Edit `SYSTEM_PROMPT` in `run_eval.py` (fastest) — or in the Edge
   Function if you want to mirror production.
3. Re-run on the same synthetic set (same `--seed`) and compare.
4. Once the synthetic score stops improving, run the pilot set. If
   pilot is much worse, the synthetic generator isn't capturing your
   real failure modes — make it harder (blur, rotation, fabric
   wrinkles) and go again.

**Keep the prompts in `run_eval.py` and `scan-clothing-tag/index.ts`
in sync once you're happy.** The harness copy exists only because the
Edge Function's TypeScript isn't ergonomic to import from Python.

## Files

```
tools/photo-scan-eval/
├── README.md              — this file
├── synth_tags.py          — synthetic tag generator
├── run_eval.py            — eval harness (both backends)
└── pilot_template.csv     — CSV template for your own photos
```
