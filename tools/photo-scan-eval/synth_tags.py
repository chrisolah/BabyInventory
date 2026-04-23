#!/usr/bin/env python3
"""
synth_tags.py — render synthetic baby-clothing tags + ground-truth CSV.

The goal isn't photorealism; it's giving the eval harness a large, cheap
dataset where every image has a known answer. Real-world photos go through
pilot/ instead.

What we vary:
  - Tag style: "hangtag" (paper rectangle, rounded corners) vs
               "care_label" (sewn-in rectangle, printed text).
  - Brand, garment type, size — sampled from pools below.
  - How the size is printed: canonical ("3-6M"), month-suffix ("6M"),
    spelled ("6 months"), toddler ("2T"), or range ("6-9 mo"). We map all
    of these back to the canonical SIZE enum in the ground truth so the
    harness can see how well the model normalizes.
  - Rotation up to ~8°, slight gaussian blur, and a tinted background so
    the model isn't getting pixel-perfect SVG-quality input.

What we deliberately DON'T vary:
  - Garment in-frame. These are tag-only images. Category is almost always
    determinable from the printed "item_descriptor" line on the tag
    ("BODYSUIT", "SLEEPER", etc.), because that's what's actually on many
    real hangtags. If Chris wants garment-in-frame testing, that's what
    the pilot set is for.

Usage:
    python3 synth_tags.py --out ./synth --count 60 --seed 42

Writes:
    <out>/images/<n>.png              ...synthetic tag images
    <out>/ground_truth.csv            ...one row per image with canonical answers
"""

from __future__ import annotations

import argparse
import csv
import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFilter, ImageFont


# ─── Enum pools — MUST stay in sync with supabase/functions/scan-clothing-tag ───
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

# Plausible baby-clothing brands. Some short, some long, some punctuated —
# the model should handle all of them.
BRANDS = [
    "Carter's", "Gerber", "OshKosh B'gosh", "Gap Baby", "H&M Baby",
    "Cat & Jack", "Old Navy", "Zara Baby", "Hanna Andersson", "Primary",
    "Little Me", "Burt's Bees Baby", "Kickee Pants", "Kyte BABY",
    "Honest Baby", "Baby Gap", "Tucker+Tate", "Petit Bateau",
]

# Garment descriptor printed on the tag → (category, item_type).
# Multiple descriptors per category so the model isn't just memorizing one.
DESCRIPTORS = [
    # tops_and_bodysuits
    ('BODYSUIT',           'tops_and_bodysuits', 'bodysuits'),
    ('ONESIE',             'tops_and_bodysuits', 'bodysuits'),
    ('LONG-SLEEVE TOP',    'tops_and_bodysuits', 'day_tops'),
    ('T-SHIRT',            'tops_and_bodysuits', 'day_tops'),
    # one_pieces
    ('ROMPER',             'one_pieces',         'one_pieces'),
    ('COVERALL',           'one_pieces',         'one_pieces'),
    # bottoms
    ('SHORTS',             'bottoms',            'shorts'),
    ('LEGGINGS',           'bottoms',            'pants_leggings'),
    ('PANTS',              'bottoms',            'pants_leggings'),
    # dresses_and_skirts
    ('DRESS',              'dresses_and_skirts', 'dresses'),
    # outerwear
    ('JACKET',             'outerwear',          'jackets'),
    ('RAIN COAT',          'outerwear',          'rain_gear'),
    # sleepwear
    ('SLEEPER',            'sleepwear',          'pajamas'),
    ('PAJAMAS',            'sleepwear',          'pajamas'),
    ('SLEEP SACK',         'sleepwear',          'sleep_sacks'),
    # footwear
    ('SOCKS',              'footwear',           'socks'),
    ('BOOTIES',            'footwear',           'shoes'),
    # accessories
    ('HAT',                'accessories',        'hats'),
    ('BIB',                'accessories',        'bibs'),
    ('MITTENS',            'accessories',        'mittens'),
    ('BURP CLOTH',         'accessories',        'burp_cloths'),
    # swimwear
    ('SWIMSUIT',           'swimwear',           'swimwear'),
]

# (printed_size, canonical_size_enum). Mix canonical with casual variants —
# the model's job is to normalize to the enum.
SIZE_PRINTED = [
    ('0-3M',       '0-3M'),
    ('3M',         '0-3M'),
    ('3 MONTHS',   '0-3M'),
    ('3 mo',       '0-3M'),
    ('NB-3M',      '0-3M'),
    ('3-6M',       '3-6M'),
    ('6M',         '3-6M'),
    ('6 MONTHS',   '3-6M'),
    ('6 mo',       '3-6M'),
    ('6-9M',       '6-9M'),
    ('9M',         '6-9M'),
    ('9 MONTHS',   '6-9M'),
    ('9-12M',      '9-12M'),
    ('12M',        '9-12M'),
    ('12 MONTHS',  '9-12M'),
    ('12-18M',     '12-18M'),
    ('18M',        '12-18M'),
    ('18 MONTHS',  '12-18M'),
    ('18-24M',     '18-24M'),
    ('24M',        '18-24M'),
    ('2T',         '18-24M'),
    ('24 MONTHS',  '18-24M'),
]

# Undocumented size variants — formats the prompt's example list does NOT
# call out explicitly. These test whether the model generalizes beyond the
# cases it was hand-tuned on. Used only in --hard mode.
SIZE_PRINTED_UNDOCUMENTED = [
    ('3 mos',    '0-3M'),    # "mos" abbreviation
    ('6mos',     '3-6M'),    # no space
    ('9mo',      '6-9M'),    # "mo" singular no space
    ('12mo',     '9-12M'),
    ('6m',       '3-6M'),    # lowercase
    ('9m',       '6-9M'),
    ('12m',      '9-12M'),
    ('18m',      '12-18M'),
    ('0/3M',     '0-3M'),    # slash separator
    ('3/6M',     '3-6M'),
    ('6/9M',     '6-9M'),
    ('SZ 6M',    '3-6M'),    # "SZ" prefix
    ('Size 12M', '9-12M'),   # "Size" prefix
    ('T24',      '18-24M'),  # "T" prefix reversed
]


@dataclass
class TagSpec:
    brand: Optional[str]
    descriptor_text: str
    category: str
    item_type: str
    size_printed: str
    size_enum: str
    style: str   # 'hangtag' or 'care_label'


# ─── Font loading with fallbacks ────────────────────────────────────────────

_FONT_CANDIDATES = [
    # macOS
    '/System/Library/Fonts/Helvetica.ttc',
    '/System/Library/Fonts/HelveticaNeue.ttc',
    '/Library/Fonts/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    # Linux / CI
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
]


def _load_font(size: int) -> ImageFont.ImageFont:
    for path in _FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    # Last resort — pixel font, still readable to the model
    return ImageFont.load_default()


# ─── Rendering ──────────────────────────────────────────────────────────────

def _rand_tag_colors(rng: random.Random, style: str) -> tuple[tuple[int,int,int], tuple[int,int,int]]:
    """Return (background, text) colors for the tag."""
    if style == 'hangtag':
        # Paper-like: cream, ivory, kraft, or stark white
        bg_options = [
            (252, 249, 240), (248, 244, 234), (237, 222, 196),
            (255, 255, 255), (243, 238, 228),
        ]
        text = (30, 30, 30)
        return rng.choice(bg_options), text
    else:
        # care_label: white, off-white, or colored fabric
        bg_options = [
            (255, 255, 255), (245, 245, 245),
            (225, 230, 240), (230, 240, 230),
        ]
        text = (20, 20, 20)
        return rng.choice(bg_options), text


def _rand_background_color(rng: random.Random) -> tuple[int,int,int]:
    """Soft, muted backdrop — not pure white so the tag has edges."""
    return (
        rng.randint(180, 230),
        rng.randint(180, 230),
        rng.randint(180, 230),
    )


def _draw_hangtag(spec: TagSpec, rng: random.Random, tag_w: int, tag_h: int) -> Image.Image:
    bg, text_color = _rand_tag_colors(rng, 'hangtag')
    tag = Image.new('RGB', (tag_w, tag_h), bg)
    draw = ImageDraw.Draw(tag)

    # Rounded border
    draw.rounded_rectangle(
        [(2, 2), (tag_w - 3, tag_h - 3)],
        radius=18,
        outline=(180, 170, 150),
        width=2,
    )

    # Hole punch at top
    hole_cx = tag_w // 2
    hole_cy = 28
    draw.ellipse(
        [(hole_cx - 9, hole_cy - 9), (hole_cx + 9, hole_cy + 9)],
        fill=(210, 200, 180),
        outline=(150, 140, 120),
        width=1,
    )

    # Brand (large, top). Occasionally omit to test null-brand handling.
    y = 60
    if spec.brand is not None:
        brand_font = _load_font(rng.randint(26, 34))
        _center_text(draw, spec.brand, brand_font, tag_w, y, text_color)
        y += brand_font.size + 12

    # Separator line
    draw.line([(tag_w // 4, y), (tag_w * 3 // 4, y)], fill=(170, 160, 140), width=1)
    y += 16

    # Descriptor (medium)
    desc_font = _load_font(22)
    _center_text(draw, spec.descriptor_text, desc_font, tag_w, y, text_color)
    y += desc_font.size + 18

    # Size — biggest element on the tag
    size_font = _load_font(rng.randint(44, 54))
    _center_text(draw, spec.size_printed, size_font, tag_w, y, text_color)
    y += size_font.size + 20

    # A fake SKU line at the bottom for realism
    sku_font = _load_font(14)
    sku = f"SKU {rng.randint(10000, 99999)}-{rng.randint(100, 999)}"
    _center_text(draw, sku, sku_font, tag_w, tag_h - 40, (140, 130, 110))

    return tag


def _draw_care_label(spec: TagSpec, rng: random.Random, tag_w: int, tag_h: int) -> Image.Image:
    bg, text_color = _rand_tag_colors(rng, 'care_label')
    tag = Image.new('RGB', (tag_w, tag_h), bg)
    draw = ImageDraw.Draw(tag)

    # Thin fabric-edge border
    draw.rectangle(
        [(1, 1), (tag_w - 2, tag_h - 2)],
        outline=(180, 180, 180),
        width=1,
    )

    y = 24
    # Brand at top in caps
    if spec.brand is not None:
        brand_font = _load_font(rng.randint(20, 26))
        _center_text(draw, spec.brand.upper(), brand_font, tag_w, y, text_color)
        y += brand_font.size + 14

    # Size row — prominent
    size_font = _load_font(rng.randint(32, 40))
    _center_text(draw, f"SIZE {spec.size_printed}", size_font, tag_w, y, text_color)
    y += size_font.size + 14

    # Descriptor
    desc_font = _load_font(16)
    _center_text(draw, spec.descriptor_text, desc_font, tag_w, y, text_color)
    y += desc_font.size + 20

    # Fake care instructions (cluttering text, as on a real label)
    small = _load_font(11)
    for line in [
        '100% COTTON', 'MACHINE WASH COLD',
        'TUMBLE DRY LOW', 'DO NOT BLEACH',
    ]:
        _center_text(draw, line, small, tag_w, y, text_color)
        y += small.size + 4

    return tag


def _center_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont,
                 tag_w: int, y: int, color: tuple[int,int,int]) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    draw.text(((tag_w - w) // 2, y), text, font=font, fill=color)


def _compose_on_background(tag: Image.Image, rng: random.Random,
                           canvas_size: tuple[int, int],
                           hard: bool = False) -> Image.Image:
    """Place the tag on a larger backdrop with rotation + blur.

    hard=True ratchets up every dimension — more rotation, more blur,
    occasional partial crop (tag shifted partly off canvas), and a subtle
    lighting gradient. This approximates phone-photo conditions: tag held
    at an angle, camera moving, uneven lighting, hand-held framing.
    """
    canvas = Image.new('RGB', canvas_size, _rand_background_color(rng))

    angle_range = 15 if hard else 8
    angle = rng.uniform(-angle_range, angle_range)
    rotated = tag.rotate(angle, expand=True, resample=Image.BICUBIC, fillcolor=(230, 228, 222))

    # Placement. In hard mode, with 25% probability, shift the tag far enough
    # that part of it crops off the canvas — simulates a phone photo where
    # the tag didn't fully fit in frame.
    if hard and rng.random() < 0.25:
        off_x = rng.choice([-1, 1]) * rng.randint(80, 180)
        off_y = rng.choice([-1, 1]) * rng.randint(40, 120)
    else:
        off_x = rng.randint(-30, 30) if hard else rng.randint(-20, 20)
        off_y = rng.randint(-30, 30) if hard else rng.randint(-20, 20)
    cx = canvas_size[0] // 2 - rotated.width // 2 + off_x
    cy = canvas_size[1] // 2 - rotated.height // 2 + off_y
    canvas.paste(rotated, (cx, cy))

    # Blur
    if hard:
        blur = rng.uniform(0.8, 2.2)
    else:
        blur = rng.uniform(0.3, 1.1)
    canvas = canvas.filter(ImageFilter.GaussianBlur(radius=blur))

    # Hard mode: add a subtle brightness gradient so lighting isn't uniform
    if hard:
        import numpy as np
        arr = np.array(canvas, dtype=np.float32)
        h, w, _ = arr.shape
        # Diagonal gradient with random direction and intensity
        direction = rng.uniform(0, 2 * 3.14159)
        import math as _math
        dx, dy = _math.cos(direction), _math.sin(direction)
        yy, xx = np.indices((h, w), dtype=np.float32)
        # Normalize coord → gradient value in [-1, 1]
        grad = (dx * (xx / w) + dy * (yy / h))
        grad = (grad - grad.min()) / (grad.max() - grad.min() + 1e-9)
        strength = rng.uniform(0.15, 0.35)       # fraction of range
        multiplier = 1.0 - strength * grad       # darker at one end
        arr = arr * multiplier[..., None]
        arr = np.clip(arr, 0, 255).astype('uint8')
        canvas = Image.fromarray(arr)

    return canvas


# ─── Spec sampling ──────────────────────────────────────────────────────────

def _sample_spec(rng: random.Random, hard: bool = False) -> TagSpec:
    descriptor_text, category, item_type = rng.choice(DESCRIPTORS)

    # In hard mode, 40% of samples use undocumented size formats so we can
    # see whether the prompt's size-mapping generalizes. Documented sizes
    # still make up the majority so results stay comparable.
    if hard and rng.random() < 0.4:
        size_printed, size_enum = rng.choice(SIZE_PRINTED_UNDOCUMENTED)
    else:
        size_printed, size_enum = rng.choice(SIZE_PRINTED)

    # 12% of the time, no brand (tests the null-brand path)
    brand = None if rng.random() < 0.12 else rng.choice(BRANDS)

    style = rng.choice(['hangtag', 'care_label'])

    return TagSpec(
        brand=brand,
        descriptor_text=descriptor_text,
        category=category,
        item_type=item_type,
        size_printed=size_printed,
        size_enum=size_enum,
        style=style,
    )


# ─── Main ───────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out',   default='./synth', help='Output directory')
    ap.add_argument('--count', type=int, default=60, help='How many tags to generate')
    ap.add_argument('--seed',  type=int, default=42, help='Deterministic seed')
    ap.add_argument('--hard',  action='store_true',
                    help='Harder mode: more rotation, more blur, partial crops, '
                         'lighting gradients, and undocumented size formats.')
    args = ap.parse_args()

    out_dir   = Path(args.out)
    img_dir   = out_dir / 'images'
    img_dir.mkdir(parents=True, exist_ok=True)

    rng = random.Random(args.seed)

    rows = []
    for i in range(args.count):
        spec = _sample_spec(rng, hard=args.hard)

        tag_w = rng.randint(300, 360)
        tag_h = rng.randint(440, 500) if spec.style == 'hangtag' else rng.randint(200, 260)

        if spec.style == 'hangtag':
            tag_img = _draw_hangtag(spec, rng, tag_w, tag_h)
        else:
            tag_img = _draw_care_label(spec, rng, tag_w, tag_h)

        canvas = _compose_on_background(tag_img, rng, canvas_size=(640, 640), hard=args.hard)

        filename = f'{i:03d}_{spec.style}.png'
        canvas.save(img_dir / filename, 'PNG', optimize=True)

        rows.append({
            'filename':       filename,
            'brand':          spec.brand or '',
            'size':           spec.size_enum,
            'category':       spec.category,
            'item_type':      spec.item_type,
            'tag_style':      spec.style,
            'size_printed':   spec.size_printed,
            'descriptor':     spec.descriptor_text,
        })

    # Write ground truth
    gt_path = out_dir / 'ground_truth.csv'
    with gt_path.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'filename', 'brand', 'size', 'category', 'item_type',
            'tag_style', 'size_printed', 'descriptor',
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f'Wrote {args.count} tags to {img_dir}')
    print(f'Wrote ground truth to {gt_path}')


if __name__ == '__main__':
    main()
