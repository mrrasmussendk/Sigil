/** Build an SVG `d` attribute for a sparkline through the given numeric points. */
export function sparkPath(points: readonly number[], width: number, height: number): string {
  if (points.length === 0) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  return points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

/** Deterministic-ish synthetic spark data for the demo. */
export function syntheticSpark(start: number, drift: number, n: number = 30): number[] {
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i += 1) {
    v += (Math.sin(i / 3) + (Math.random() - 0.5)) * drift;
    out.push(Number(v.toFixed(2)));
  }
  return out;
}
