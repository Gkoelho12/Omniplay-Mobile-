/* OmniPlay Mobile · Motor Completo da Mexicana (52 cartas + 4 Jokers, poderes e eventos de animação) */
import { GameEngine, SessionPlayer } from '../services/session';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♦', '♣'];
export const ORDER: Record<string, number> = {
  '4': 0, '5': 1, '6': 2, '7': 3, '8': 4, '9': 5,
  J: 6, Q: 7, K: 8, A: 9, '2': 10, '3': 11, '10': 12, X: 13
};
export const ORDER_NAME = ['4', '5', '6', '7', '8', '9', 'J', 'Q', 'K', 'A', '2', '3', '10', 'Joker'];
export const POWER = new Set(['2', '3', '7', '8', '10', 'X']);
export const CLEAN = new Set(['10', 'X']);
export const GLYPH: Record<string, string> = { '2': '↺', '3': '🪞', '7': '↕', '8': '⛔', '10': '🧹', X: '🧹' };
export const SEVEN = ORDER['7'];
export const EIGHT = ORDER['8'];

export const rk = (id: number): string => (id >= 52 ? 'X' : RANKS[id % 13]);
export const su = (id: number): number => (id >= 52 ? -1 : Math.floor(id / 13));
export const ord = (id: number): number => ORDER[rk(id)];
export const cardTxt = (id: number): string => (rk(id) === 'X' ? '🃏' : rk(id) + SUITS[su(id)]);
export const byOrder = (a: number, b: number): number => ord(a) - ord(b) || su(a) - su(b);

export interface MexicanaEvent {
  id: number;
  type: 'start' | 'play' | 'clean' | 'take' | 'blind_fail' | 'dir' | 'end';
  seat?: number;
  cards?: number[];
  cleared?: number[];
  taken?: number[];
  cleanKind?: 'joker' | 'four' | 'ten';
  power?: 'reset' | 'mirror' | 'seven' | 'block' | null;
  drawnCount?: number;
  lucky?: boolean;
  blockedSeats?: number[];
  dir?: 'up' | 'down';
  starters?: number[];
  startRank?: string;
  blind?: { id: number; ok: boolean; idx: number };
}

export interface MexicanaState {
  n: number;
  phase: 'setup' | 'start' | 'play' | 'over';
  names: string[];
  stock: number[];
  center: number[];
  discard: number[];
  hands: number[][];
  hidden: number[][];
  faceUp: number[][];
  ready: boolean[];
  starters: number[];
  startRank: string | null;
  turn: number;
  turnPlays: number;
  turnRank: string | null;
  dir: 'up' | 'down' | null;
  pending: 'dir' | null;
  canEnd: boolean;
  winner: number;
  flip: { seat: number; id: number; ok: boolean; n: number } | null;
  seq: number;
  evt: MexicanaEvent | null;
  log: string[];
}

function shuffle(a: number[]): number[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextSeq(s: MexicanaState): number {
  s.seq = (s.seq || 0) + 1;
  return s.seq;
}

export function effAt(center: number[], upto: number): number | null {
  let e: number | null = null;
  for (let i = 0; i <= upto; i++) {
    const r = rk(center[i]);
    if (r === '2') e = null;
    else if (r !== '3') e = ORDER[r];
  }
  return e;
}

export const effTop = (c: number[]): number | null => (c.length ? effAt(c, c.length - 1) : null);

export function playable(s: MexicanaState, r: string): boolean {
  if (r === '2' || r === '3' || r === '10' || r === 'X') return true;
  const e = effTop(s.center);
  if (e == null) return true;
  const o = ORDER[r];
  if (e === SEVEN && s.dir === 'down') return o <= SEVEN;
  if (e === SEVEN && s.dir === 'up') return o >= SEVEN;
  return o >= e;
}

export function group(s: MexicanaState, ids: number[]): { base: number[]; threes: number[] } | null {
  if (!ids.length || new Set(ids).size !== ids.length) return null;
  const base = ids.filter((i) => rk(i) !== '3');
  const threes = ids.filter((i) => rk(i) === '3');
  const allClean = base.length > 0 && base.every((i) => CLEAN.has(rk(i)));
  if (!allClean && new Set(base.map(rk)).size > 1) return null;
  if (base.length && !playable(s, rk(base[0]))) return null;
  if (s.turnPlays > 0 && base.length && (s.turnRank == null || rk(base[0]) !== s.turnRank)) return null;
  return { base, threes };
}

export function validPlay(s: MexicanaState, ids: number[]): { base: number[]; threes: number[] } | null {
  const g = group(s, ids);
  if (!g) return null;
  if (s.phase === 'start') {
    if (s.startRank === '3') return g.base.length ? null : g;
    if (!g.base.length || g.base.some((i) => rk(i) !== s.startRank)) return null;
  }
  return g;
}

const fourKind = (c: number[]): boolean =>
  c.length >= 4 && rk(c[c.length - 1]) !== '3' && c.slice(-4).every((i) => rk(i) === rk(c[c.length - 1]));

const finished = (s: MexicanaState, seat: number): boolean =>
  !s.hands[seat].length && !s.faceUp[seat].length && !s.hidden[seat].length;

function say(s: MexicanaState, txt: string) {
  s.log.push(txt);
  if (s.log.length > 6) s.log.shift();
}

function refill(s: MexicanaState, seat: number): number[] {
  const h = s.hands[seat];
  const drawn: number[] = [];
  while (h.length < 3 && s.stock.length) {
    const c = s.stock.pop()!;
    h.push(c);
    drawn.push(c);
  }
  if (!h.length && !s.stock.length && s.faceUp[seat].length) {
    h.push(...s.faceUp[seat].splice(0));
    say(s, `${s.names[seat]} pegou as cartas viradas para cima`);
  }
  return drawn;
}

function advance(s: MexicanaState, steps: number) {
  s.turn = (s.turn + steps) % s.n;
  s.turnPlays = 0;
  s.turnRank = null;
  s.canEnd = false;
  s.pending = null;
}

function endTurn(s: MexicanaState, evt?: MexicanaEvent) {
  s.canEnd = false;
  const e = effTop(s.center);
  if (s.turnPlays > 0 && e === SEVEN) {
    s.pending = 'dir';
    return;
  }
  let skip = 0;
  const blockedSeats: number[] = [];
  if (s.turnPlays > 0 && e === EIGHT) {
    for (let i = s.center.length - 1; i >= 0 && skip < s.turnPlays; i--) {
      const r = rk(s.center[i]);
      if (r !== '8' && !(r === '3' && effAt(s.center, i) === EIGHT)) break;
      skip++;
    }
    // Nunca bloqueia o próprio jogador que jogou (máximo s.n - 1 adversários)
    skip = Math.min(skip, Math.max(0, s.n - 1));
    for (let k = 1; k <= skip; k++) blockedSeats.push((s.turn + k) % s.n);
    if (skip) say(s, `⛔ ${skip} jogador${skip > 1 ? 'es' : ''} bloqueado${skip > 1 ? 's' : ''}`);
  }
  if (evt && blockedSeats.length) evt.blockedSeats = blockedSeats;
  advance(s, 1 + skip);
}

function doPlay(
  s: MexicanaState,
  seat: number,
  g: { base: number[]; threes: number[] },
  extraEvt: Partial<MexicanaEvent> = {}
): MexicanaState {
  const cards = [...g.base, ...g.threes];
  s.dir = null;
  s.center.push(...cards);
  s.turnPlays += cards.length;
  if (g.base.length) {
    s.turnRank = rk(g.base[0]);
  } else {
    const e = effTop(s.center);
    s.turnRank = e != null ? (ORDER_NAME[e] === 'Joker' ? 'X' : ORDER_NAME[e]) : '3';
  }
  say(s, `${s.names[seat]} jogou ${cards.map(cardTxt).join(' ')}`);

  const hasCleanCard = g.base.some((i) => CLEAN.has(rk(i)));
  const isFour = !hasCleanCard && fourKind(s.center);
  if (hasCleanCard || isFour) {
    const cleared = [...s.center];
    const cleanKind: 'four' | 'joker' | 'ten' = isFour
      ? 'four'
      : cards.some((i) => rk(i) === 'X')
        ? 'joker'
        : 'ten';
    s.discard.push(...s.center);
    s.center = [];
    s.turnPlays = 0;
    s.turnRank = null;
    s.canEnd = false;
    say(s, `🧹 ${s.names[seat]} limpou a mesa e joga outra vez`);
    const drawn = refill(s, seat);
    if (finished(s, seat)) {
      s.phase = 'over';
      s.winner = seat;
    }
    s.evt = {
      id: nextSeq(s),
      type: 'clean',
      seat,
      cards,
      cleared,
      cleanKind,
      drawnCount: drawn.length,
      ...extraEvt
    };
    return s;
  }

  const drawn = refill(s, seat);
  const topR = g.base.length ? rk(g.base[0]) : '3';
  const power =
    topR === '2' ? 'reset' : topR === '7' ? 'seven' : topR === '8' ? 'block' : g.threes.length ? 'mirror' : null;
  const evt: MexicanaEvent = {
    id: nextSeq(s),
    type: 'play',
    seat,
    cards,
    power,
    drawnCount: drawn.length,
    lucky: false,
    blockedSeats: [],
    ...extraEvt
  };
  s.evt = evt;

  if (finished(s, seat)) {
    s.phase = 'over';
    s.winner = seat;
    return s;
  }
  const can = s.hands[seat].some((i) => rk(i) === '3' || (s.turnRank != null && rk(i) === s.turnRank));
  if (drawn.length) {
    const lucky = drawn.some((i) => rk(i) === '3' || (s.turnRank != null && rk(i) === s.turnRank));
    if (lucky) {
      evt.lucky = true;
      say(s, `✨ ${s.names[seat]} comprou ${drawn.map(cardTxt).join(' ')} — pode jogar por cima!`);
    }
  }
  if (can) s.canEnd = true;
  else endTurn(s, evt);
  return s;
}

function startPhase(s: MexicanaState) {
  let best = Infinity;
  for (const h of s.hands) {
    for (const i of h) {
      if (!POWER.has(rk(i))) best = Math.min(best, ord(i));
    }
  }
  const nonPower = best !== Infinity;
  if (!nonPower) {
    for (const h of s.hands) {
      for (const i of h) best = Math.min(best, ord(i));
    }
  }
  s.starters = [];
  s.hands.forEach((h, seat) => {
    if (h.some((i) => ord(i) === best && (nonPower ? !POWER.has(rk(i)) : true))) s.starters.push(seat);
  });
  s.startRank = ORDER_NAME[best] === 'Joker' ? 'X' : ORDER_NAME[best];
  s.phase = 'start';
  say(
    s,
    s.starters.length === 1
      ? `${s.names[s.starters[0]]} tem a carta mais baixa (${s.startRank}) e começa`
      : `Empate de ${s.startRank}: quem jogar primeiro começa!`
  );
}

export const MexicanaEngine: GameEngine<MexicanaState> = {
  id: 'mexicana',
  name: 'Mexicana',
  minPlayers: 2,
  maxPlayers: 6,

  init(n: number, { players }: { players: SessionPlayer[] }): MexicanaState {
    const deck = shuffle(Array.from({ length: 56 }, (_, i) => i));
    const hidden: number[][] = [];
    const hands: number[][] = [];
    for (let i = 0; i < n; i++) hidden.push(deck.splice(0, 3));
    for (let i = 0; i < n; i++) hands.push(deck.splice(0, 6));
    return {
      n,
      phase: 'setup',
      names: players.map((p) => p.name),
      stock: deck,
      center: [],
      discard: [],
      hands,
      hidden,
      faceUp: Array.from({ length: n }, () => []),
      ready: Array(n).fill(false),
      starters: [],
      startRank: null,
      turn: 0,
      turnPlays: 0,
      turnRank: null,
      dir: null,
      pending: null,
      canEnd: false,
      winner: -1,
      flip: null,
      seq: 0,
      evt: null,
      log: ['As cartas foram dadas. Escolhe 3 para ficarem à vista.']
    };
  },

  reduce(s: MexicanaState, a: any, seat: number): MexicanaState | null {
    if (s.phase === 'over') return null;

    if (a.type === 'setup') {
      if (s.phase !== 'setup' || s.ready[seat] || !Array.isArray(a.ids)) return null;
      const ids: number[] = a.ids;
      if (ids.length !== 3 || new Set(ids).size !== 3 || !ids.every((i) => s.hands[seat].includes(i))) return null;
      s.faceUp[seat] = [...ids].sort(byOrder);
      s.hands[seat] = s.hands[seat].filter((i) => !ids.includes(i));
      s.ready[seat] = true;
      if (s.ready.every(Boolean)) {
        startPhase(s);
        s.evt = { id: nextSeq(s), type: 'start', starters: s.starters, startRank: s.startRank || '4' };
      }
      return s;
    }

    if (a.type === 'play') {
      if (!Array.isArray(a.ids)) return null;
      if (s.phase === 'start') {
        if (!s.starters.includes(seat)) return null;
      } else if (s.phase !== 'play' || seat !== s.turn || s.pending) {
        return null;
      }
      if (!a.ids.every((i: number) => s.hands[seat].includes(i))) return null;
      const g = validPlay(s, a.ids);
      if (!g) return null;
      if (s.phase === 'start') {
        s.phase = 'play';
        s.turn = seat;
      }
      s.hands[seat] = s.hands[seat].filter((i) => !a.ids.includes(i));
      return doPlay(s, seat, g);
    }

    if (s.phase !== 'play' || seat !== s.turn) return null;

    if (a.type === 'dir') {
      if (s.pending !== 'dir' || (a.dir !== 'up' && a.dir !== 'down')) return null;
      s.dir = a.dir;
      say(s, `↕ ${s.names[seat]} escolheu ${a.dir === 'up' ? 'ACIMA' : 'ABAIXO'} do 7`);
      s.evt = { id: nextSeq(s), type: 'dir', seat, dir: a.dir };
      advance(s, 1);
      return s;
    }
    if (s.pending) return null;

    if (a.type === 'end') {
      if (!s.turnPlays || !s.canEnd) return null;
      const evt: MexicanaEvent = { id: nextSeq(s), type: 'end', seat, blockedSeats: [] };
      endTurn(s, evt);
      if (evt.blockedSeats?.length || s.pending === 'dir') s.evt = evt;
      return s;
    }

    if (a.type === 'take') {
      if (s.turnPlays || !s.center.length) return null;
      const taken = [...s.center];
      say(s, `${s.names[seat]} pegou ${s.center.length} carta${s.center.length > 1 ? 's' : ''} do meio`);
      s.hands[seat].push(...s.center);
      s.center = [];
      s.dir = null;
      const drawn = refill(s, seat);
      s.evt = { id: nextSeq(s), type: 'take', seat, taken, drawnCount: drawn.length };
      advance(s, 1);
      return s;
    }

    if (a.type === 'blind') {
      if (s.turnPlays || s.hands[seat].length || s.faceUp[seat].length || s.stock.length) return null;
      if (!Number.isInteger(a.idx) || a.idx < 0 || a.idx >= s.hidden[seat].length) return null;
      const id = s.hidden[seat].splice(a.idx, 1)[0];
      const ok = playable(s, rk(id));
      s.flip = { seat, id, ok, n: (s.flip ? s.flip.n : 0) + 1 };
      if (ok) {
        return doPlay(s, seat, rk(id) === '3' ? { base: [], threes: [id] } : { base: [id], threes: [] }, {
          blind: { id, ok: true, idx: a.idx }
        });
      }
      const taken = [id, ...s.center];
      say(s, `${s.names[seat]} virou ${cardTxt(id)} e não pode jogar — leva as cartas`);
      s.hands[seat].push(id, ...s.center);
      s.center = [];
      s.dir = null;
      s.evt = { id: nextSeq(s), type: 'blind_fail', seat, cards: [id], taken, blind: { id, ok: false, idx: a.idx } };
      advance(s, 1);
      return s;
    }

    return null;
  },

  result(s: MexicanaState) {
    if (s.phase !== 'over') return null;
    return Array.from({ length: s.n }, (_, i) => ({
      seat: i,
      result: (i === s.winner ? 'win' : 'loss') as 'win' | 'loss',
      score: s.hands[i].length + s.faceUp[i].length + s.hidden[i].length
    }));
  },

  info(s: MexicanaState) {
    return {
      turn: s.phase === 'play' ? s.turn : null,
      scores: s.hands.map((h, i) =>
        s.phase === 'over' && s.winner === i ? '🏆 sem cartas' : `✋${h.length} · 👁${s.faceUp[i].length} · 🂠${s.hidden[i].length}`
      )
    };
  }
};

