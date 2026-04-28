// In-page DOM diagnostics for mobile QA.
//
// Exported as a string because Playwright's page.evaluate() takes a function
// it serializes; importing helpers from this file directly would lose the
// closure. Keep the body self-contained — no external refs.
//
// Returns an object: { issues: Issue[], stats: {...} }
// where Issue = {
//   kind: 'horizontal_overflow' | 'child_overflow' | 'content_clipped'
//       | 'small_text' | 'small_tap_target' | 'offscreen',
//   selector: string,            // best-effort path for triage
//   tag: string,
//   text: string,                // first 80 chars of textContent if any
//   detail: object,              // kind-specific numbers
// }
//
// Selectors are produced by a tiny path builder — id if present, else
// tag + nth-of-type chain up to 4 levels deep. Good enough for human triage.

export const DIAGNOSTIC_FN = `
(() => {
  const VIEWPORT_W = window.innerWidth;
  const issues = [];

  function pathFor(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + el.id;
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && depth < 4) {
      const tag = cur.tagName.toLowerCase();
      if (cur === document.documentElement) {
        parts.unshift('html');
        break;
      }
      const parent = cur.parentElement;
      if (!parent) { parts.unshift(tag); break; }
      const sameTag = [...parent.children].filter((c) => c.tagName === cur.tagName);
      const idx = sameTag.indexOf(cur) + 1;
      parts.unshift(sameTag.length > 1 ? tag + ':nth-of-type(' + idx + ')' : tag);
      cur = parent;
      depth++;
    }
    return parts.join(' > ');
  }

  function summarize(el) {
    const t = (el.textContent || '').trim().replace(/\\s+/g, ' ');
    return t.length > 80 ? t.slice(0, 77) + '…' : t;
  }

  // Horizontal page overflow
  if (document.documentElement.scrollWidth > VIEWPORT_W + 1) {
    issues.push({
      kind: 'horizontal_overflow',
      selector: 'html',
      tag: 'html',
      text: '',
      detail: {
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: VIEWPORT_W,
        overshoot: document.documentElement.scrollWidth - VIEWPORT_W,
      },
    });
  }

  // Walk every element once
  const all = document.querySelectorAll('*');
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // Off-screen (way past right edge)
    if (rect.left > VIEWPORT_W + 4) {
      issues.push({
        kind: 'offscreen',
        selector: pathFor(el),
        tag: el.tagName.toLowerCase(),
        text: summarize(el),
        detail: { left: Math.round(rect.left), viewportWidth: VIEWPORT_W },
      });
    }

    // Content clipped horizontally inside this box (not the page itself —
    // page-level overflow already reported above).
    if (el !== document.documentElement && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX === 'hidden') {
        // Only flag when content is hidden, not when it's intentionally scrollable
        const t = summarize(el);
        if (t || el.children.length > 0) {
          issues.push({
            kind: 'content_clipped',
            selector: pathFor(el),
            tag: el.tagName.toLowerCase(),
            text: t,
            detail: {
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              overshoot: el.scrollWidth - el.clientWidth,
            },
          });
        }
      }
    }

    // Child rendered outside parent bounding box (only flag direct, in-flow
    // children — absolute/fixed positioning is allowed to escape).
    const parent = el.parentElement;
    if (parent && parent !== document.documentElement) {
      const pcs = getComputedStyle(parent);
      const pos = cs.position;
      if (pos === 'static' || pos === 'relative') {
        const prect = parent.getBoundingClientRect();
        if (prect.width > 0 && rect.right > prect.right + 1 && pcs.overflow === 'visible') {
          issues.push({
            kind: 'child_overflow',
            selector: pathFor(el),
            tag: el.tagName.toLowerCase(),
            text: summarize(el),
            detail: {
              childRight: Math.round(rect.right),
              parentRight: Math.round(prect.right),
              overshoot: Math.round(rect.right - prect.right),
            },
          });
        }
      }
    }

    // Small text (visible text nodes only)
    const hasText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent && n.textContent.trim()
    );
    if (hasText) {
      const fs = parseFloat(cs.fontSize);
      if (fs && fs < 12) {
        issues.push({
          kind: 'small_text',
          selector: pathFor(el),
          tag: el.tagName.toLowerCase(),
          text: summarize(el),
          detail: { fontSize: fs },
        });
      }
    }

    // Small tap targets — only flag interactive elements
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const isInteractive =
      tag === 'button' ||
      tag === 'a' ||
      (tag === 'input' && el.type !== 'hidden') ||
      tag === 'select' ||
      tag === 'textarea' ||
      role === 'button' ||
      role === 'link' ||
      el.onclick != null;

    if (isInteractive && (rect.width < 44 || rect.height < 44)) {
      issues.push({
        kind: 'small_tap_target',
        selector: pathFor(el),
        tag,
        text: summarize(el),
        detail: { width: Math.round(rect.width), height: Math.round(rect.height) },
      });
    }
  }

  // Dedupe child_overflow / content_clipped chains — when a parent overflows,
  // children inside it tend to all overflow too. Keep only the topmost.
  const dedupedSet = new Set();
  const deduped = [];
  for (const issue of issues) {
    if (issue.kind === 'child_overflow' || issue.kind === 'content_clipped') {
      // Skip if any ancestor selector is already flagged with same kind
      const key = issue.kind + '::' + issue.selector;
      if (dedupedSet.has(key)) continue;
      dedupedSet.add(key);
    }
    deduped.push(issue);
  }

  return {
    issues: deduped,
    stats: {
      total: deduped.length,
      byKind: deduped.reduce((acc, i) => {
        acc[i.kind] = (acc[i.kind] || 0) + 1;
        return acc;
      }, {}),
      viewportWidth: VIEWPORT_W,
      viewportHeight: window.innerHeight,
      pageScrollWidth: document.documentElement.scrollWidth,
      pageScrollHeight: document.documentElement.scrollHeight,
    },
  };
})()
`;
