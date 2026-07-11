// Builds a windowed page-number list with '...' gaps, e.g. [1, 'gap-4', 4, 5, 6, 'gap-10', 10]
export function getPaginationRange(current, total) {
  if (total <= 1) return [1];
  const pages = new Set([1, total, current]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i > 1 && i < total) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let prev = null;
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) result.push(`gap-${p}`);
    result.push(p);
    prev = p;
  }
  return result;
}
