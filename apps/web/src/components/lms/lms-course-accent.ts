/** Deterministic duo-tone accent for course shells when department colour isn't on the API payload (Prompt 8.2). */

const PALETTES = [
  ['#2563eb', '#7c3aed'],
  ['#059669', '#0d9488'],
  ['#c026d3', '#db2777'],
  ['#d97706', '#ea580c'],
  ['#0891b2', '#4f46e5'],
];

function hashCode(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function lmsCourseGradient(seed: string): string {
  const pair = PALETTES[hashCode(seed) % PALETTES.length];
  return `linear-gradient(90deg, ${pair[0]}, ${pair[1]})`;
}
