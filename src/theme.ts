/* OmniPlay Mobile · Design System, Cores, Níveis e Utilitários */
export const COLORS = {
  bg: '#07080d',
  bg2: '#0d0f18',
  panel: 'rgba(255, 255, 255, 0.055)',
  panelStrong: 'rgba(15, 18, 30, 0.92)',
  panelBorder: 'rgba(255, 255, 255, 0.11)',
  text: '#eef1f8',
  muted: '#8b93a7',
  cyan: '#22d3ee',
  violet: '#a78bfa',
  orange: '#fb923c',
  pink: '#f472b6',
  good: '#34d399',
  bad: '#fb7185',
  warn: '#fbbf24'
};

export const PCOL = ['#22d3ee', '#f472b6', '#facc15', '#a78bfa', '#34d399', '#fb923c'];

export const AVATARS = [
  '🎮', '👾', '🚀', '🦊', '🐺', '🐙', '🦄', '🐲', '🤖', '👻',
  '🦉', '🐼', '🔥', '⚡', '🌙', '🍀', '💎', '🎲', '🧠', '🦖'
];

export const REWARD: Record<'win' | 'draw' | 'loss', { xp: number; coins: number }> = {
  win: { xp: 50, coins: 20 },
  draw: { xp: 25, coins: 10 },
  loss: { xp: 15, coins: 5 }
};

export interface FrameInfo {
  cls: 'f0' | 'f1' | 'f2' | 'f3' | 'f4';
  min: number;
  name: string;
  borderColor: string;
  glowColor: string;
}

export const FRAMES: FrameInfo[] = [
  { cls: 'f0', min: 1, name: 'Sem moldura', borderColor: 'rgba(255,255,255,0.2)', glowColor: 'transparent' },
  { cls: 'f1', min: 3, name: 'Anel Ciano', borderColor: '#22d3ee', glowColor: 'rgba(34,211,238,0.55)' },
  { cls: 'f2', min: 6, name: 'Pulso Violeta', borderColor: '#a78bfa', glowColor: 'rgba(167,139,250,0.65)' },
  { cls: 'f3', min: 10, name: 'Chama Elétrica', borderColor: '#fb923c', glowColor: 'rgba(251,146,60,0.75)' },
  { cls: 'f4', min: 15, name: 'Omni Prismático', borderColor: '#f472b6', glowColor: 'rgba(244,114,182,0.85)' }
];

export function levelInfo(xp: number = 0) {
  const cleanXp = Math.max(0, Math.floor(xp || 0));
  const level = Math.floor(Math.sqrt(cleanXp / 100)) + 1;
  const base = 100 * (level - 1) ** 2;
  const next = 100 * level ** 2;
  return {
    level,
    cur: cleanXp - base,
    need: next - base,
    pct: Math.min(100, ((cleanXp - base) / (next - base)) * 100)
  };
}

export function frameFor(xp: number = 0): FrameInfo {
  const l = levelInfo(xp).level;
  let f = FRAMES[0];
  for (const fr of FRAMES) {
    if (l >= fr.min) f = fr;
  }
  return f;
}

export function uid(n = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < n; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function hslColor(hue: number = 190, s = 72, l = 38): string {
  return `hsl(${Math.round(hue)}, ${s}%, ${l}%)`;
}

