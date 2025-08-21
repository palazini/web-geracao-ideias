export function norm(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function textToPrefixes(t: string, {
  minLen = 3,
  maxLen = 6,
  maxPrefixes = 50,   // para não explodir o array
} = {}) {
  const seen = new Set<string>();
  const out: string[] = [];
  const words = norm(t).split(/[^a-z0-9]+/).filter(w => w.length >= minLen);
  for (const w of words) {
    for (let k = minLen; k <= Math.min(maxLen, w.length); k++) {
      const p = w.slice(0, k);
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
        if (out.length >= maxPrefixes) return out;
      }
    }
  }
  return out;
}
