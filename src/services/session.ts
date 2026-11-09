/* OmniPlay Mobile · Salas Online (Supabase Realtime) e Sessão de Jogo (100% compatível com o site) */
import { RealtimeChannel } from '@supabase/supabase-js';
import { Backend } from './backend';
import { uid } from '../theme';

export interface RoomMember {
  key: string;
  uid: string | null;
  userId: string | null;
  name: string;
  avatar: string;
  color: number;
  xp: number;
  host: boolean;
  isHost: boolean;
  playing: boolean;
  gameId: string;
  maxPlayers: number;
  t: number;
  joinedAt: number;
}

export interface SessionPlayer {
  seat: number;
  name: string;
  avatar: string;
  color: number;
  xp: number;
  userId: string | null;
  key?: string;
}

export class Room {
  code: string;
  gameId: string;
  isHost: boolean;
  maxPlayers: number;
  playing = false;
  key: string;
  joinedAt: number;
  ch: RealtimeChannel | null = null;
  members: RoomMember[] = [];
  handlers: Record<string, Array<(payload?: any) => void>> = {};
  closed = false;

  constructor(code: string, gameId: string, isHost: boolean, maxPlayers = 4) {
    this.code = code.toUpperCase();
    this.gameId = gameId;
    this.isHost = isHost;
    this.maxPlayers = maxPlayers;
    this.key = uid(8);
    this.joinedAt = Date.now();
  }

  on(ev: string, fn: (payload?: any) => void) {
    (this.handlers[ev] = this.handlers[ev] || []).push(fn);
  }

  emit(ev: string, d?: any) {
    (this.handlers[ev] || []).forEach((fn) => {
      try {
        fn(d);
      } catch (e) {
        console.error(e);
      }
    });
  }

  meta(): RoomMember {
    const me = Backend.me();
    const myUid = Backend.user?.id || null;
    return {
      key: this.key,
      uid: myUid,
      userId: myUid,
      name: me.display_name || me.username,
      avatar: me.avatar,
      color: me.color,
      xp: me.xp || 0,
      host: this.isHost,
      isHost: this.isHost,
      playing: this.playing,
      gameId: this.gameId,
      maxPlayers: this.maxPlayers,
      t: this.joinedAt,
      joinedAt: this.joinedAt
    };
  }

  open(): Promise<Room> {
    return new Promise((resolve, reject) => {
      if (!Backend.sb) {
        reject(new Error('Sem ligação ao servidor.'));
        return;
      }
      // Usa exatamente o mesmo nome de canal que o site ('room:' + this.code)
      const ch = Backend.sb.channel('room:' + this.code, {
        config: { presence: { key: this.key }, broadcast: { self: false, ack: false } }
      });
      this.ch = ch;
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          this.close();
          reject(new Error('Tempo esgotado a ligar à sala.'));
        }
      }, 9000);

      ch.on('presence', { event: 'sync' }, () => this._sync());
      ch.on('presence', { event: 'leave' }, ({ key, currentPresences, leftPresences }) => {
        if (this.closed) return;
        const stillHere =
          (currentPresences && currentPresences.length > 0) ||
          (key != null && ((this.ch?.presenceState() || {})[key] || []).length > 0);
        if (stillHere) return;
        const left = leftPresences || [];
        if (!left.length) return;
        const leftHost = left.some((p: any) => Boolean(p.isHost || p.host));
        setTimeout(() => {
          if (this.closed) return;
          if (key != null && ((this.ch?.presenceState() || {})[key] || []).length > 0) return;
          this._sync();
          if (leftHost && !this.members.some((m) => m.isHost)) {
            this.emit('hostleft');
          } else {
            this.emit('memberleft', left[0] || left);
          }
        }, 1500);
      });

      ['start', 'state', 'action', 'need_state', 'abort'].forEach((ev) => {
        ch.on('broadcast', { event: ev }, ({ payload }) => this.emit(ev, payload));
      });

      ch.subscribe(async (st) => {
        if (st === 'SUBSCRIBED') {
          await ch.track(this.meta());
          const finishJoin = () => {
            if (done) return;
            this._sync();
            if (!this.isHost) {
              const host = this.members.find((m) => m.isHost);
              if (!host) {
                done = true;
                clearTimeout(timer);
                this.close();
                reject(new Error('Sala não encontrada (verifica o código).'));
                return;
              }
              if (host.playing) {
                done = true;
                clearTimeout(timer);
                this.close();
                reject(new Error('Essa sala já está a meio de uma partida.'));
                return;
              }
              this.gameId = host.gameId || 'mexicana';
              this.maxPlayers = host.maxPlayers || 4;
              if (this.members.length > this.maxPlayers) {
                done = true;
                clearTimeout(timer);
                this.close();
                reject(new Error('A sala já está cheia.'));
                return;
              }
            }
            done = true;
            clearTimeout(timer);
            resolve(this);
          };

          if (this.isHost) {
            setTimeout(finishJoin, 350);
          } else {
            let waited = 0;
            const poll = () => {
              if (done || this.closed) return;
              this._sync();
              if (this.members.some((m) => m.isHost) || waited >= 4500) {
                finishJoin();
              } else {
                waited += 150;
                setTimeout(poll, 150);
              }
            };
            setTimeout(poll, 200);
          }
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
          if (!done) {
            done = true;
            clearTimeout(timer);
            this.close();
            reject(new Error('Falha na ligação em tempo real.'));
          }
        }
      });
    });
  }

  _sync() {
    if (!this.ch) return;
    const raw = this.ch.presenceState();
    const list: RoomMember[] = Object.entries(raw)
      .filter(([, metas]) => metas && (metas as any[]).length > 0)
      .map(([k, metas]) => {
        const m = (metas as any[])[0] || {};
        const isHost = Boolean(m.isHost || m.host);
        const userId = m.userId || m.uid || null;
        const joinedAt = m.joinedAt || m.t || 0;
        return {
          ...m,
          key: m.key || k,
          uid: userId,
          userId,
          host: isHost,
          isHost,
          t: joinedAt,
          joinedAt,
          gameId: m.gameId || 'mexicana',
          maxPlayers: m.maxPlayers || this.maxPlayers || 4
        } as RoomMember;
      });

    if (!list.some((m) => m.key === this.key)) {
      list.push(this.meta());
    }
    list.sort(
      (a, b) =>
        (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0) ||
        a.joinedAt - b.joinedAt ||
        String(a.key).localeCompare(String(b.key))
    );
    const host = list.find((m) => m.isHost);
    if (host && host.maxPlayers) this.maxPlayers = host.maxPlayers;
    this.members = list;
    this.emit('members', this.members);
  }

  async setPlaying(v: boolean) {
    this.playing = v;
    try {
      if (this.ch && !this.closed) {
        await this.ch.track(this.meta());
      }
    } catch {
      // ignore
    }
  }

  send(event: string, payload: any) {
    if (this.closed || !this.ch) return;
    this.ch.send({ type: 'broadcast', event, payload });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.ch && Backend.sb) Backend.sb.removeChannel(this.ch);
    } catch {
      // ignore
    }
  }
}

export const Rooms = {
  genCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },
  async create(gameId: string, maxPlayers: number): Promise<Room> {
    if (!Backend.sb) throw new Error('Modo offline — joga no mesmo dispositivo.');
    for (let i = 0; i < 4; i++) {
      const r = new Room(this.genCode(), gameId, true, maxPlayers);
      await r.open();
      if (r.members.filter((m) => m.isHost).length <= 1) return r;
      r.close();
    }
    throw new Error('Não foi possível criar a sala.');
  },
  async join(code: string): Promise<Room> {
    if (!Backend.sb) throw new Error('Modo offline — não é possível entrar em salas.');
    const clean = (code || '').trim().toUpperCase();
    if (clean.length !== 4) throw new Error('O código tem 4 caracteres.');
    const r = new Room(clean, 'mexicana', false);
    return r.open();
  }
};

export interface GameEngine<S = any> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  init(n: number, opts: { players: SessionPlayer[] }): S;
  reduce(state: S, action: any, seat: number, now?: number): S | null;
  result(state: S): Array<{ seat: number; result: 'win' | 'loss' | 'draw'; score: number }> | null;
  info(state: S): { turn: number | null; scores: string[] };
}

export interface GameSessionOptions<S = any> {
  game: GameEngine<S>;
  players: SessionPlayer[];
  role: 'local' | 'host' | 'guest';
  mySeats: number[];
  room: Room | null;
  token: string;
  onState?: (s: S) => void;
  onFinish?: (res: Array<{ seat: number; result: 'win' | 'loss' | 'draw'; score: number }>) => void;
}

export class GameSession<S = any> {
  game: GameEngine<S>;
  players: SessionPlayer[];
  role: 'local' | 'host' | 'guest';
  mySeats: number[];
  room: Room | null;
  token: string;
  onState?: (s: S) => void;
  onFinish?: (res: Array<{ seat: number; result: 'win' | 'loss' | 'draw'; score: number }>) => void;
  state: S | null = null;
  version = 0;
  finished = false;
  startedAt = Date.now();
  duration = 0;
  results: Array<{ seat: number; result: 'win' | 'loss' | 'draw'; score: number }> = [];
  mode: 'local' | 'online';
  dead = false;

  constructor(opts: GameSessionOptions<S>) {
    this.game = opts.game;
    this.players = opts.players;
    this.role = opts.role;
    this.mySeats = opts.mySeats;
    this.room = opts.room;
    this.token = opts.token;
    this.onState = opts.onState;
    this.onFinish = opts.onFinish;
    this.mode = this.role === 'local' ? 'local' : 'online';
    this._bind();

    if (this.role !== 'guest') {
      this.state = this.game.init(this.players.length, { players: this.players });
      this.version = 1;
      if (this.role === 'host') this._broadcast();
      setTimeout(() => {
        if (this.state && !this.dead) {
          this.onState && this.onState(this.state);
          this._check();
        }
      }, 0);
    } else if (this.room) {
      try {
        this.room.send('need_state', { token: this.token });
      } catch {
        // ignore
      }
      setTimeout(() => {
        if (!this.state && !this.dead && this.room) {
          this.room.send('need_state', { token: this.token });
        }
      }, 800);
    }
  }

  _bind() {
    if (!this.room) return;
    this.room.on('state', (p) => {
      if (this.role === 'guest' && p.token === this.token) this._receive(p);
    });
    this.room.on('action', (p) => {
      if (this.role !== 'host' || p.token !== this.token) return;
      this._apply(p.action, p.seat);
    });
    this.room.on('need_state', () => {
      if (this.role === 'host') this._broadcast();
    });
  }

  _receive(p: { v: number; state: S; token: string }) {
    if (p.v <= this.version) return;
    this.version = p.v;
    this.state = p.state;
    this.onState && this.onState(this.state);
    this._check();
  }

  _broadcast() {
    if (!this.room) return;
    this.room.send('state', { token: this.token, v: this.version, state: this.state });
  }

  dispatch(action: any, seat?: number) {
    if (this.finished) return;
    let targetSeat = seat;
    if (this.mySeats.length === 1) targetSeat = this.mySeats[0];
    if (targetSeat == null) targetSeat = this.mySeats[0];
    if (this.role === 'guest') {
      this.room?.send('action', { token: this.token, action, seat: targetSeat });
      return;
    }
    this._apply(action, targetSeat);
  }

  _apply(action: any, seat: number) {
    if (this.finished || !this.state) return;
    const copy = JSON.parse(JSON.stringify(this.state)) as S;
    const ns = this.game.reduce(copy, action, seat, Date.now());
    if (ns) this._set(ns);
  }

  _set(ns: S) {
    this.state = ns;
    this.version++;
    if (this.role === 'host') this._broadcast();
    this.onState && this.onState(ns);
    this._check();
  }

  _check() {
    if (this.finished || !this.state) return;
    const res = this.game.result(this.state);
    if (!res) return;
    this.finished = true;
    this.results = res;
    this.duration = Math.round((Date.now() - this.startedAt) / 1000);
    setTimeout(() => this.onFinish && this.onFinish(res), 950);
  }

  record() {
    const bySeat = Object.fromEntries(this.results.map((r) => [r.seat, r]));
    return {
      key: (this.room ? this.room.code : 'L') + '-' + this.token + '-' + this.startedAt.toString(36),
      game: this.game.id,
      mode: this.mode,
      duration: this.duration,
      players: this.players.map((p) => ({
        user_id: p.userId || null,
        name: p.name,
        seat: p.seat,
        result: (bySeat[p.seat]?.result || 'loss') as 'win' | 'loss' | 'draw',
        score: bySeat[p.seat]?.score || 0
      }))
    };
  }

  destroy() {
    this.dead = true;
  }
}

export function newToken(): string {
  return uid(6);
}
