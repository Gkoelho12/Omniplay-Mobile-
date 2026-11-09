/* OmniPlay Mobile · Camada de Dados (Supabase + modo offline/convidado) */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { OMNI_CONFIG } from '../config';
import { LS } from './storage';
import { AVATARS, REWARD, uid } from '../theme';

export interface UserProfile {
  id: string | null;
  username: string;
  display_name: string;
  avatar: string;
  color: number;
  xp: number;
  coins: number;
  bio?: string;
  created_at?: string;
  password?: string;
  history?: MatchHistoryItem[];
}

export interface MatchPlayerRecord {
  user_id: string | null;
  name: string;
  seat: number;
  result: 'win' | 'loss' | 'draw';
  score: number;
}

export interface MatchRecordPayload {
  key: string;
  game: string;
  mode: 'online' | 'local';
  duration: number;
  players: MatchPlayerRecord[];
}

export interface MatchHistoryItem {
  game_id: string;
  mode: string;
  duration_s: number;
  played_at: string;
  result: 'win' | 'loss' | 'draw';
  score: number;
  xp_gain: number;
  players: MatchPlayerRecord[];
}

export interface FriendItem {
  fid: string | number;
  profile: UserProfile;
}

export interface FriendsBundle {
  friends: FriendItem[];
  incoming: FriendItem[];
  outgoing: FriendItem[];
}

export interface H2HGameRow {
  game_id: string;
  name: string;
  icon: string;
  hue: number;
  wins: number;
  losses: number;
  draws: number;
  played: number;
}

export interface InvitePayload {
  to: string;
  room: string;
  game: string;
  from: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
    color: number;
  };
}

type ListenerFn = (data?: any) => void;
const listeners: Record<string, ListenerFn[]> = {};

export const PLATFORM_GAMES = [
  { id: 'mexicana', name: 'Mexicana', icon: '🃏', hue: 330 },
  { id: 'connect4', name: '4 em Linha', icon: '🔴', hue: 345 },
  { id: 'reflex', name: 'Reflexo Rápido', icon: '⚡', hue: 45 }
];

export const Backend = {
  sb: null as SupabaseClient | null,
  configured: false,
  user: null as UserProfile | null,
  guest: null as UserProfile | null,
  onlineIds: new Set<string>(),
  hub: null as RealtimeChannel | null,
  hubReady: null as Promise<boolean> | null,

  on(evt: string, fn: ListenerFn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return () => {
      listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn);
    };
  },

  emit(evt: string, data?: any) {
    (listeners[evt] || []).forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(e);
      }
    });
  },

  get account(): boolean {
    return !!this.user;
  },

  get canNet(): boolean {
    return !!(this.sb && this.user);
  },

  me(): UserProfile {
    if (this.user) return this.user;
    if (!this.guest) {
      this.guest = {
        id: null,
        username: 'convidado',
        display_name: 'Convidado',
        avatar: AVATARS[0],
        color: 190,
        xp: 0,
        coins: 0,
        bio: '',
        history: []
      };
    }
    return this.guest;
  },

  async init(): Promise<void> {
    await LS.init();
    const effectiveKey = OMNI_CONFIG.SUPABASE_ANON_KEY;
    this.configured = !!(OMNI_CONFIG.SUPABASE_URL && effectiveKey);

    this.guest = LS.get<UserProfile | null>('guest', null) || {
      id: null,
      username: 'convidado',
      display_name: 'Convidado',
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      color: Math.floor(Math.random() * 360),
      xp: 0,
      coins: 0,
      bio: '',
      history: []
    };
    LS.set('guest', this.guest);

    const cached = LS.get<UserProfile | null>('profile', null);
    const isLoggedIn = LS.get<boolean>('loggedIn', false);

    if (this.configured) {
      this.sb = createClient(OMNI_CONFIG.SUPABASE_URL, effectiveKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false
        },
        realtime: {
          params: { eventsPerSecond: 20 }
        }
      });

      let session = null;
      try {
        session = (await this.sb.auth.getSession()).data.session;
      } catch {
        // Sem ligação
      }

      if (session) {
        this.user = cached && cached.id === session.user.id ? cached : null;
        await this.refreshProfile(session.user.id).catch(() => {});
      } else if (cached && isLoggedIn) {
        this.user = cached;
      }

      this.sb.auth.onAuthStateChange((ev) => {
        if (ev === 'SIGNED_OUT' && this.user) this._clearAccount();
      });
    } else if (cached && isLoggedIn) {
      this.user = cached;
    }

    if (this.user) {
      this.flushQueue();
      this.joinHub();
    }
  },

  _email(username: string): string {
    return `${username}@${OMNI_CONFIG.EMAIL_DOMAIN || 'omniplay.app'}`;
  },

  validUsername(u: string): boolean {
    return /^[a-z0-9_]{3,16}$/.test(u);
  },

  getSavedAccounts(): UserProfile[] {
    const accounts = LS.get<Record<string, UserProfile>>('accounts', {});
    return Object.values(accounts).map((a) => ({
      id: a.id || null,
      username: a.username,
      display_name: a.display_name || a.username,
      avatar: a.avatar || '🎮',
      color: a.color ?? 190,
      xp: a.xp || 0,
      coins: a.coins || 0
    }));
  },

  async signUp(
    username: string,
    password: string,
    displayName?: string,
    avatar?: string,
    color?: number
  ): Promise<UserProfile> {
    username = (username || '').trim().toLowerCase();
    if (!this.validUsername(username)) {
      throw new Error('Username deve ter 3 a 16 caracteres (letras, números ou _).');
    }
    if (!password || password.length < 4) {
      throw new Error('A password precisa de pelo menos 4 caracteres.');
    }

    const dn = (displayName || '').trim() || username;
    const av = avatar || AVATARS[0];
    const col = typeof color === 'number' ? color : 190;

    if (this.configured && this.sb) {
      const { data, error } = await this.sb.auth.signUp({
        email: this._email(username),
        password,
        options: { data: { username, display_name: dn, avatar: av, color: col } }
      });
      if (error) {
        throw new Error(/already|registered/i.test(error.message) ? 'Esse username já existe.' : error.message);
      }
      if (!data.session || !data.user) {
        throw new Error('Desativa "Confirm email" no Supabase (Authentication > Providers > Email).');
      }
      await this.refreshProfile(data.user.id);
      this._afterLogin();
      return this.user!;
    }

    const accounts = LS.get<Record<string, UserProfile>>('accounts', {});
    if (accounts[username]) {
      throw new Error(`O username "@${username}" já existe neste dispositivo.`);
    }

    const newAccount: UserProfile = {
      id: 'loc_' + uid(12),
      username,
      display_name: dn,
      password,
      avatar: av,
      color: col,
      xp: this.guest?.xp || 0,
      coins: 50 + (this.guest?.coins || 0),
      bio: 'Jogador do OmniPlay 🚀',
      created_at: new Date().toISOString(),
      history: this.guest?.history || []
    };

    accounts[username] = newAccount;
    LS.set('accounts', accounts);
    this.user = newAccount;
    LS.set('profile', newAccount);
    this._afterLogin();
    return newAccount;
  },

  async signIn(username: string, password: string): Promise<UserProfile> {
    username = (username || '').trim().toLowerCase();
    if (!username) throw new Error('Por favor introduz o teu username.');
    if (!password) throw new Error('Por favor introduz a tua password.');

    if (this.configured && this.sb) {
      const { data, error } = await this.sb.auth.signInWithPassword({
        email: this._email(username),
        password
      });
      if (error) {
        const localAcc = (LS.get<Record<string, UserProfile>>('accounts', {}) || {})[username];
        if (localAcc && localAcc.password === password) {
          try {
            const { data: upData, error: upErr } = await this.sb.auth.signUp({
              email: this._email(username),
              password,
              options: {
                data: {
                  username,
                  display_name: localAcc.display_name || username,
                  avatar: localAcc.avatar,
                  color: localAcc.color
                }
              }
            });
            if (!upErr && upData?.user) {
              await this.refreshProfile(upData.user.id);
              this._afterLogin();
              return this.user!;
            }
          } catch {
            // Continua para o erro abaixo
          }
        }
        throw new Error(/invalid/i.test(error.message) ? 'Username ou password incorretos.' : error.message);
      }
      await this.refreshProfile(data.user.id);
      this._afterLogin();
      return this.user!;
    }

    const accounts = LS.get<Record<string, UserProfile>>('accounts', {});
    const acc = accounts[username];
    if (!acc) throw new Error(`Conta "@${username}" não encontrada. Cria uma conta para jogar!`);
    if (acc.password !== password) throw new Error('Password incorreta. Tenta novamente.');

    this.user = acc;
    LS.set('profile', acc);
    this._afterLogin();
    return acc;
  },

  _afterLogin() {
    LS.set('loggedIn', true);
    if (this.user) {
      const accounts = LS.get<Record<string, UserProfile>>('accounts', {});
      accounts[this.user.username] = { ...accounts[this.user.username], ...this.user };
      LS.set('accounts', accounts);
    }
    this.flushQueue();
    this.joinHub();
    this.emit('auth');
    this.emit('profile');
  },

  async signOut() {
    try {
      await this.sb?.auth.signOut();
    } catch {
      // ignore
    }
    this._clearAccount();
  },

  _clearAccount() {
    this.user = null;
    LS.del('profile');
    LS.set('loggedIn', false);
    this.leaveHub();
    this.emit('auth');
    this.emit('profile');
  },

  async refreshProfile(id?: string): Promise<UserProfile | null> {
    const targetId = id || this.user?.id;
    if (!this.sb || !targetId) return this.user;

    let res: UserProfile | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data } = await this.sb.from('profiles').select('*').eq('id', targetId).maybeSingle();
      if (data) {
        res = data as UserProfile;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!res) {
      try {
        const session = (await this.sb.auth.getSession()).data?.session;
        if (session && session.user && session.user.id === targetId) {
          const meta = session.user.user_metadata || {};
          const uname = (meta.username || session.user.email?.split('@')[0] || 'jogador').toLowerCase();
          const payload = {
            id: session.user.id,
            username: uname,
            display_name: meta.display_name || uname,
            avatar: meta.avatar || '🎮',
            color: typeof meta.color === 'number' ? meta.color : 190
          };
          const { data: created } = await this.sb.from('profiles').upsert(payload).select('*').maybeSingle();
          if (created) res = created as UserProfile;
        }
      } catch {
        // ignore
      }
    }

    if (!res) throw new Error('Perfil não encontrado.');
    this.user = res;
    LS.set('profile', res);
    this.emit('profile');
    return res;
  },

  async updateProfile(patch: Partial<UserProfile>): Promise<void> {
    if (!this.user) {
      const g = this.me();
      Object.assign(g, patch);
      this.guest = g;
      LS.set('guest', g);
      this.emit('profile');
      return;
    }
    Object.assign(this.user, patch);
    LS.set('profile', this.user);
    const accounts = LS.get<Record<string, UserProfile>>('accounts', {});
    if (accounts[this.user.username]) {
      Object.assign(accounts[this.user.username], patch);
      LS.set('accounts', accounts);
    }
    this.emit('profile');
    if (this.canNet && this.sb && this.user.id) {
      const { error } = await this.sb.from('profiles').update(patch).eq('id', this.user.id);
      if (error) throw error;
    }
  },

  async cached<T>(key: string, fn: () => Promise<T>): Promise<{ data: T; stale: boolean }> {
    const k = 'c.' + (this.user?.id || 'guest') + '.' + key;
    try {
      if (!this.canNet) throw new Error('offline');
      const v = await fn();
      LS.set(k, { t: Date.now(), v });
      return { data: v, stale: false };
    } catch (e) {
      const c = LS.get<{ t: number; v: T } | null>(k, null);
      if (c) return { data: c.v, stale: true };
      throw e;
    }
  },

  async searchUsers(text: string): Promise<UserProfile[]> {
    const raw = (text || '').trim();
    if (!raw) return [];
    const cleanTarget = raw.replace(/^@/, '').toLowerCase();
    const cleanUname = cleanTarget.replace(/[^a-z0-9_]/g, '').slice(0, 20);

    if (this.canNet && this.sb) {
      try {
        const queryTerm = cleanUname || cleanTarget;
        let q = this.sb
          .from('profiles')
          .select('id,username,display_name,avatar,color,xp,coins,bio')
          .or(`username.ilike.%${queryTerm}%,display_name.ilike.%${cleanTarget}%`);
        if (this.user?.id) q = q.neq('id', this.user.id);
        const { data, error } = await q.limit(12);
        if (!error && data) return data as UserProfile[];
      } catch {
        // fallback local
      }
    }

    const accounts = LS.get<Record<string, UserProfile>>('accounts', {});
    const meU = (this.me().username || '').toLowerCase();
    return Object.values(accounts).filter(
      (a) =>
        a.username.toLowerCase() !== meU &&
        (a.username.toLowerCase().includes(cleanTarget) ||
          (a.display_name || '').toLowerCase().includes(cleanTarget))
    );
  },

  async getFriends(): Promise<{ data: FriendsBundle; stale: boolean }> {
    if (!this.canNet || !this.sb || !this.user?.id) {
      return { data: { friends: [], incoming: [], outgoing: [] }, stale: false };
    }
    return this.cached('friends', async () => {
      const me = this.user!.id!;
      const { data: rows, error } = await this.sb!
        .from('friendships')
        .select('id,requester,addressee,status')
        .or(`requester.eq.${me},addressee.eq.${me}`);
      if (error) throw error;
      const ids = [...new Set((rows || []).map((r: any) => (r.requester === me ? r.addressee : r.requester)))];
      let profs: UserProfile[] = [];
      if (ids.length) {
        const r = await this.sb!
          .from('profiles')
          .select('id,username,display_name,avatar,color,xp,coins,bio')
          .in('id', ids);
        if (r.error) throw r.error;
        profs = (r.data || []) as UserProfile[];
      }
      const byId = Object.fromEntries(profs.map((p) => [p.id!, p]));
      const out: FriendsBundle = { friends: [], incoming: [], outgoing: [] };
      (rows || []).forEach((r: any) => {
        const other = byId[r.requester === me ? r.addressee : r.requester];
        if (!other) return;
        const item: FriendItem = { fid: r.id, profile: other };
        if (r.status === 'accepted') out.friends.push(item);
        else if (r.addressee === me) out.incoming.push(item);
        else out.outgoing.push(item);
      });
      out.friends.sort((a, b) => (a.profile?.username || '').localeCompare(b.profile?.username || ''));
      return out;
    });
  },

  async sendRequest(otherIdOrUsername: string): Promise<void> {
    if (!this.canNet || !this.sb || !this.user?.id) {
      throw new Error('Inicia sessão para adicionares amigos.');
    }
    const clean = (otherIdOrUsername || '').trim().replace(/^@/, '').toLowerCase();
    if (!clean) throw new Error('Indica o username do amigo.');
    if (clean === this.user.username.toLowerCase() || clean === this.user.id.toLowerCase()) {
      throw new Error('Não podes adicionar-te a ti próprio!');
    }

    let targetUuid = clean;
    if (!/^[0-9a-f-]{36}$/i.test(clean)) {
      const { data: prof, error: pErr } = await this.sb
        .from('profiles')
        .select('id')
        .ilike('username', clean)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!prof) throw new Error(`O jogador @${clean} ainda não criou conta no OmniPlay.`);
      targetUuid = prof.id;
    }

    const { error } = await this.sb
      .from('friendships')
      .insert({ requester: this.user.id, addressee: targetUuid });
    if (error) {
      throw new Error(
        (error as any).code === '23505'
          ? 'Já existe um pedido ou amizade com este jogador.'
          : error.message
      );
    }
  },

  async acceptRequest(fid: string | number): Promise<void> {
    if (!this.canNet || !this.sb) return;
    const { error } = await this.sb.from('friendships').update({ status: 'accepted' }).eq('id', fid);
    if (error) throw error;
  },

  async removeFriendship(fid: string | number): Promise<void> {
    if (!this.canNet || !this.sb) return;
    const { error } = await this.sb.from('friendships').delete().eq('id', fid);
    if (error) throw error;
  },

  async getH2H(otherId: string): Promise<H2HGameRow[]> {
    const empty = PLATFORM_GAMES.map((g) => ({
      game_id: g.id,
      name: g.name,
      icon: g.icon,
      hue: g.hue,
      wins: 0,
      losses: 0,
      draws: 0,
      played: 0
    }));
    if (!this.canNet || !this.sb || !this.user?.id || !otherId) return empty;
    try {
      const { data: rows, error } = await this.sb.rpc('head_to_head', {
        p_user: this.user.id,
        p_other: otherId
      });
      if (error || !rows) return empty;
      const map = Object.fromEntries((rows as any[]).map((r) => [r.game_id, r]));
      return PLATFORM_GAMES.map((g) => {
        const found = map[g.id];
        return {
          game_id: g.id,
          name: g.name,
          icon: g.icon,
          hue: g.hue,
          wins: found ? found.wins : 0,
          losses: found ? found.losses : 0,
          draws: found ? found.draws : 0,
          played: found ? found.wins + found.losses + found.draws : 0
        };
      });
    } catch {
      return empty;
    }
  },

  async getLeaderboard(): Promise<{ data: UserProfile[]; stale: boolean }> {
    if (!this.canNet || !this.sb) {
      return { data: [this.me()], stale: true };
    }
    return this.cached('lb', async () => {
      const { data, error } = await this.sb!.rpc('leaderboard');
      if (error) throw error;
      return (data || []) as UserProfile[];
    });
  },

  async getHistory(id?: string | null, limit = 25): Promise<{ data: MatchHistoryItem[]; stale: boolean }> {
    const targetId = id || this.user?.id;
    if (!targetId || !this.canNet || !this.sb) {
      const hist = (this.user ? this.user.history : this.guest?.history) || [];
      return { data: hist.slice(0, limit), stale: false };
    }
    return this.cached('hist.' + targetId, async () => {
      const { data, error } = await this.sb!
        .from('match_players')
        .select(
          'result,score,xp_gain,played_at,match:matches(id,game_id,mode,duration_s,players:match_players(user_id,name,seat,result,score))'
        )
        .eq('user_id', targetId)
        .order('played_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || [])
        .filter((r: any) => r.match)
        .map((r: any) => ({
          game_id: r.match.game_id,
          mode: r.match.mode,
          duration_s: r.match.duration_s,
          played_at: r.played_at,
          result: r.result,
          score: r.score,
          xp_gain: r.xp_gain,
          players: (r.match.players || []).sort((a: any, b: any) => a.seat - b.seat)
        }));
    });
  },

  async submitMatch(rec: MatchRecordPayload): Promise<void> {
    const r0 = rec.players[0];
    if (!this.user) {
      const g = this.me();
      const rw = REWARD[r0.result] || REWARD.loss;
      g.xp += rw.xp;
      g.coins += rw.coins;
      g.history = [
        {
          game_id: rec.game,
          mode: rec.mode,
          duration_s: rec.duration,
          played_at: new Date().toISOString(),
          result: r0.result,
          score: r0.score,
          xp_gain: rw.xp,
          players: rec.players
        },
        ...(g.history || [])
      ].slice(0, 50);
      this.guest = g;
      LS.set('guest', g);
      this.emit('profile');
      return;
    }

    const mine = rec.players.find((p) => p.user_id === this.user!.id) || rec.players[0];
    if (!mine) return;
    const rw = REWARD[mine.result] || REWARD.loss;
    this.user.xp = (this.user.xp || 0) + rw.xp;
    this.user.coins = (this.user.coins || 0) + rw.coins;
    this.user.history = [
      {
        game_id: rec.game,
        mode: rec.mode,
        duration_s: rec.duration,
        played_at: new Date().toISOString(),
        result: mine.result,
        score: mine.score,
        xp_gain: rw.xp,
        players: rec.players
      },
      ...(this.user.history || [])
    ].slice(0, 50);
    LS.set('profile', this.user);
    this.emit('profile');

    if (this.canNet && this.sb) {
      const { error } = await this.sb.rpc('submit_match', {
        p_client_key: rec.key,
        p_game: rec.game,
        p_mode: rec.mode,
        p_duration: rec.duration,
        p_players: rec.players
      });
      if (error && !(error as any).code) {
        const q = LS.get<MatchRecordPayload[]>('queue', []);
        if (!q.find((x) => x.key === rec.key)) q.push(rec);
        LS.set('queue', q);
      } else {
        this.refreshProfile().catch(() => {});
      }
    }
  },

  async flushQueue(): Promise<void> {
    if (!this.canNet || !this.sb || !this.user) return;
    const q = LS.get<MatchRecordPayload[]>('queue', []);
    if (!q.length) return;
    const rest: MatchRecordPayload[] = [];
    for (const rec of q) {
      const { error } = await this.sb.rpc('submit_match', {
        p_client_key: rec.key,
        p_game: rec.game,
        p_mode: rec.mode,
        p_duration: rec.duration,
        p_players: rec.players
      });
      if (error && !(error as any).code) rest.push(rec);
    }
    LS.set('queue', rest);
    this.refreshProfile().catch(() => {});
  },

  /* ============ Hub Realtime: presença + convites ============ */
  joinHub(): void {
    if (!this.canNet || !this.sb || !this.user?.id || this.hub) return;
    const ch = this.sb.channel('omni-hub', {
      config: { presence: { key: this.user.id }, broadcast: { self: false, ack: false } }
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const ids = new Set<string>(Object.keys(state));
      Object.values(state).forEach((arr: any) => {
        (arr || []).forEach((m: any) => {
          if (m?.id) ids.add(String(m.id));
          if (m?.username) ids.add(String(m.username).toLowerCase());
        });
      });
      this.onlineIds = ids;
      this.emit('presence');
    });
    ch.on('broadcast', { event: 'invite' }, ({ payload }) => {
      if (!payload || !this.user) return;
      const myId = this.user.id;
      const myUname = (this.user.username || '').toLowerCase();
      const pTo = String(payload.to || '');
      const pToUname = String(payload.toUsername || '').toLowerCase();
      if (
        (myId && pTo === myId) ||
        (myUname && pTo.toLowerCase() === myUname) ||
        (myUname && pToUname === myUname)
      ) {
        this.emit('invite', payload as InvitePayload);
      }
    });
    this.hubReady = new Promise((resolve) => {
      ch.subscribe(async (st) => {
        if (st === 'SUBSCRIBED') {
          try {
            await ch.track({
              id: this.user?.id,
              username: this.user?.username,
              at: Date.now()
            });
          } catch {
            // ignore
          }
          resolve(true);
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
          if (this.hub === ch) {
            this.hub = null;
            this.hubReady = null;
          }
          resolve(false);
        }
      });
    });
    this.hub = ch;
  },

  leaveHub(): void {
    if (this.hub && this.sb) {
      try {
        this.sb.removeChannel(this.hub);
      } catch {
        // ignore
      }
    }
    this.hub = null;
    this.hubReady = null;
    this.onlineIds = new Set();
    this.emit('presence');
  },

  async sendInvite(toIdOrUsername: string, room: string, game = 'mexicana'): Promise<boolean> {
    if (!this.canNet || !toIdOrUsername || !this.user?.id || !this.sb) return false;

    let targetId = toIdOrUsername.trim();
    let targetUsername = '';

    // Se passaram um @username (não é UUID), resolve o UUID na tabela profiles:
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const cleanU = targetId.replace(/^@/, '').toLowerCase();
      targetUsername = cleanU;
      try {
        const { data: prof } = await this.sb
          .from('profiles')
          .select('id,username')
          .ilike('username', cleanU)
          .maybeSingle();
        if (prof?.id) {
          targetId = prof.id;
          targetUsername = (prof.username || cleanU).toLowerCase();
        }
      } catch {
        // continua com o username
      }
    } else {
      try {
        const { data: prof } = await this.sb
          .from('profiles')
          .select('username')
          .eq('id', targetId)
          .maybeSingle();
        if (prof?.username) targetUsername = prof.username.toLowerCase();
      } catch {
        // ignore
      }
    }

    const me = this.user;
    const trySendOnce = async (): Promise<boolean> => {
      if (!this.hub || !this.hubReady) {
        this.leaveHub();
        this.joinHub();
      }
      if (!this.hub || !this.hubReady) return false;
      const ready = await Promise.race([
        this.hubReady,
        new Promise<boolean>((r) => setTimeout(() => r(false), 5000))
      ]);
      if (!ready || !this.hub) return false;
      try {
        const res = await this.hub.send({
          type: 'broadcast',
          event: 'invite',
          payload: {
            to: targetId,
            toUsername: targetUsername,
            room,
            game,
            from: {
              id: me.id,
              username: me.username,
              display_name: me.display_name,
              avatar: me.avatar,
              color: me.color
            }
          }
        });
        return res === 'ok';
      } catch {
        return false;
      }
    };

    const firstOk = await trySendOnce();
    if (firstOk) return true;

    // Reconecta o hub uma vez se o canal estivesse adormecido no telemóvel:
    this.leaveHub();
    this.joinHub();
    return trySendOnce();
  },

  newKey(): string {
    return uid(16);
  }
};

