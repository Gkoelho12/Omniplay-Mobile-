import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Share,
  StyleSheet
} from 'react-native';
import { COLORS, PCOL, REWARD, AVATARS } from '../theme';
import { Backend, FriendItem } from '../services/backend';
import { Room, Rooms, GameSession, SessionPlayer, newToken } from '../services/session';
import { MexicanaEngine, MexicanaState } from '../games/mexicanaEngine';
import { AvatarView } from '../components/AvatarView';
import { MexicanaBoard } from '../components/MexicanaBoard';

interface MexicanaScreenProps {
  initialRoomCode?: string | null;
  challengeFriendId?: string | null;
  onClearInitialParams: () => void;
  onBackToHub: () => void;
  onOpenFriends: () => void;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

export const MexicanaScreen: React.FC<MexicanaScreenProps> = ({
  initialRoomCode,
  challengeFriendId,
  onClearInitialParams,
  onBackToHub,
  onOpenFriends,
  onOpenAuth,
  onToast
}) => {
  const [screen, setScreen] = useState<'setup' | 'lobby' | 'game'>('setup');
  const [setupTab, setSetupTab] = useState<'online' | 'local'>('online');
  const [onlineMax, setOnlineMax] = useState<number>(4);
  const [joinCode, setJoinCode] = useState<string>('');
  const [localN, setLocalN] = useState<number>(2);
  const [localNames, setLocalNames] = useState<string[]>([
    Backend.me().display_name || Backend.me().username,
    'Jogador 2',
    'Jogador 3',
    'Jogador 4',
    'Jogador 5',
    'Jogador 6'
  ]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [inviteUname, setInviteUname] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [gameState, setGameState] = useState<MexicanaState | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [resultsData, setResultsData] = useState<
    Array<{ seat: number; result: 'win' | 'loss' | 'draw'; score: number }> | null
  >(null);
  const [busy, setBusy] = useState(false);

  const sessionRef = useRef<GameSession<MexicanaState> | null>(null);
  const roomRef = useRef<Room | null>(null);

  const loadFriends = async () => {
    if (!Backend.account) {
      setFriends([]);
      return;
    }
    try {
      const r = await Backend.getFriends();
      const sorted = [...(r.data.friends || [])].sort(
        (a, b) =>
          (Backend.onlineIds.has(b.profile.id!) ? 1 : 0) -
          (Backend.onlineIds.has(a.profile.id!) ? 1 : 0)
      );
      setFriends(sorted);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadFriends();
    const unsub1 = Backend.on('presence', loadFriends);
    const unsub2 = Backend.on('auth', loadFriends);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  useEffect(() => {
    if (initialRoomCode) {
      const code = initialRoomCode;
      onClearInitialParams();
      handleJoinRoom(code);
    } else if (challengeFriendId) {
      const fid = challengeFriendId;
      onClearInitialParams();
      handleCreateAndInvite(fid);
    }
  }, [initialRoomCode, challengeFriendId]);

  useEffect(() => {
    return () => {
      sessionRef.current?.destroy();
      roomRef.current?.close();
    };
  }, []);

  const bindRoomEvents = (r: Room) => {
    roomRef.current = r;
    setRoom(r);
    setMembers([...r.members]);

    r.on('members', (list) => {
      setMembers([...list]);
    });

    r.on('hostleft', () => {
      onToast('O anfitrião saiu da sala.');
      leaveAll();
    });

    r.on('abort', () => {
      onToast('A partida foi encerrada.');
      backToLobby();
    });

    r.on('start', ({ players, token }) => {
      if (r.isHost) return;
      let meSeat = players.find((p: any) => p.key === r.key)?.seat;
      if (meSeat == null && Backend.user?.id) {
        meSeat = players.find((p: any) => p.userId === Backend.user!.id)?.seat;
      }
      if (meSeat == null) return;
      startOnlineSession(r, players, 'guest', meSeat, token);
    });
  };

  const leaveAll = () => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    roomRef.current?.close();
    roomRef.current = null;
    setRoom(null);
    setGameState(null);
    setResultsData(null);
    setInvitedIds(new Set());
    setScreen('setup');
  };

  const backToLobby = () => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setGameState(null);
    setResultsData(null);
    if (roomRef.current) {
      roomRef.current.setPlaying(false);
      setMembers([...roomRef.current.members]);
      setScreen('lobby');
    } else {
      setScreen('setup');
    }
  };

  const handleCreateRoom = async () => {
    if (!Backend.account) {
      onOpenAuth();
      return;
    }
    setBusy(true);
    try {
      leaveAll();
      const r = await Rooms.create('mexicana', onlineMax);
      bindRoomEvents(r);
      setScreen('lobby');
      loadFriends();
    } catch (e: any) {
      onToast(e?.message || 'Erro ao criar sala.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async (codeArg?: string) => {
    if (!Backend.account) {
      onOpenAuth();
      return;
    }
    const clean = (codeArg || joinCode).trim().toUpperCase();
    if (clean.length !== 4) {
      onToast('Introduz um código de 4 letras.');
      return;
    }
    setBusy(true);
    try {
      leaveAll();
      const r = await Rooms.join(clean);
      bindRoomEvents(r);
      setScreen('lobby');
      loadFriends();
    } catch (e: any) {
      onToast(e?.message || 'Não foi possível entrar na sala.');
    } finally {
      setBusy(false);
    }
  };

  const markInvitedTemporarily = (idOrUname: string) => {
    setInvitedIds((prev) => new Set(prev).add(idOrUname));
    setTimeout(() => {
      setInvitedIds((prev) => {
        const next = new Set(prev);
        next.delete(idOrUname);
        return next;
      });
    }, 8000);
  };

  const handleCreateAndInvite = async (friendId: string) => {
    if (!Backend.account) {
      onOpenAuth();
      return;
    }
    setBusy(true);
    try {
      leaveAll();
      const r = await Rooms.create('mexicana', onlineMax);
      bindRoomEvents(r);
      setScreen('lobby');
      loadFriends();
      const ok = await Backend.sendInvite(friendId, r.code, 'mexicana');
      if (ok) {
        markInvitedTemporarily(friendId);
        onToast(`Sala ${r.code} criada e convite enviado! 🃏`);
      } else {
        onToast(`Sala ${r.code} criada! Partilha o código com o teu amigo.`);
      }
    } catch (e: any) {
      onToast(e?.message || 'Erro ao criar sala.');
    } finally {
      setBusy(false);
    }
  };

  const handleLobbyInviteFriend = async (friendId: string, name: string) => {
    if (!room) return;
    const ok = await Backend.sendInvite(friendId, room.code, 'mexicana');
    if (ok) {
      markInvitedTemporarily(friendId);
      onToast(`Convite enviado a ${name}! 🃏`);
    } else {
      onToast('Não foi possível enviar o convite agora.');
    }
  };

  const handleLobbyInviteByUsername = async () => {
    if (!room) return;
    const raw = inviteUname.trim().replace(/^@/, '').toLowerCase();
    if (!raw) {
      onToast('Escreve o @username do jogador que queres convidar.');
      return;
    }
    const ok = await Backend.sendInvite(raw, room.code, 'mexicana');
    if (ok) {
      setInviteUname('');
      onToast(`Convite enviado para @${raw}! 🃏`);
    } else {
      onToast(`Não foi possível enviar convite a @${raw}. Verifica se está online.`);
    }
  };

  const handleShareRoom = async () => {
    if (!room) return;
    try {
      await Share.share({
        message: `🃏 Vem jogar Mexicana comigo no OmniPlay! Entra na sala com o código: ${room.code}`
      });
    } catch {
      // ignore
    }
  };

  const handleHostStartOnline = async () => {
    if (!room || !room.isHost) return;
    const players: SessionPlayer[] = room.members.slice(0, room.maxPlayers).map((m, i) => ({
      seat: i,
      name: m.name,
      avatar: m.avatar,
      color: m.color,
      xp: m.xp,
      userId: m.userId,
      key: m.key
    }));
    if (players.length < 2) {
      onToast('São precisos pelo menos 2 jogadores na sala.');
      return;
    }
    const token = newToken();
    await room.setPlaying(true);
    room.send('start', { gameId: 'mexicana', players, token });
    const mySeat = players.find((p) => p.key === room.key)?.seat ?? 0;
    startOnlineSession(room, players, 'host', mySeat, token);
  };

  const startOnlineSession = (
    r: Room,
    players: SessionPlayer[],
    role: 'host' | 'guest',
    mySeat: number,
    token: string
  ) => {
    sessionRef.current?.destroy();
    setResultsData(null);
    const sess = new GameSession<MexicanaState>({
      game: MexicanaEngine,
      players,
      role,
      mySeats: [mySeat],
      room: r,
      token,
      onState: (st) => setGameState({ ...st }),
      onFinish: (res) => {
        setResultsData(res);
        if (role !== 'guest') {
          Backend.submitMatch(sess.record());
        } else {
          setTimeout(() => Backend.refreshProfile().catch(() => {}), 2000);
        }
      }
    });
    sessionRef.current = sess;
    if (sess.state) setGameState({ ...sess.state });
    setScreen('game');
  };

  const handleStartLocal = () => {
    const me = Backend.me();
    const players: SessionPlayer[] = Array.from({ length: localN }, (_, i) => ({
      seat: i,
      name: (localNames[i] || `Jogador ${i + 1}`).trim(),
      avatar: i === 0 ? me.avatar : AVATARS[(i * 3 + 2) % AVATARS.length],
      color: i === 0 ? me.color : (i * 65 + 40) % 360,
      xp: i === 0 ? me.xp || 0 : 0,
      userId: i === 0 ? Backend.user?.id || null : null
    }));

    sessionRef.current?.destroy();
    setResultsData(null);
    const sess = new GameSession<MexicanaState>({
      game: MexicanaEngine,
      players,
      role: 'local',
      mySeats: players.map((p) => p.seat),
      room: null,
      token: newToken(),
      onState: (st) => setGameState({ ...st }),
      onFinish: (res) => {
        setResultsData(res);
        Backend.submitMatch(sess.record());
      }
    });
    sessionRef.current = sess;
    if (sess.state) setGameState({ ...sess.state });
    setScreen('game');
  };

  const renderRulesModal = () => (
    <Modal visible={rulesOpen} transparent animationType="fade" onRequestClose={() => setRulesOpen(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>🃏 Regras da Mexicana</Text>
            <View style={{ gap: 8 }}>
              <Text style={styles.ruleItem}>
                • <Text style={styles.cyanBold}>Objetivo:</Text> Ficar sem cartas (mão, à vista e viradas para baixo). Baralho de 52 cartas + 4 Jokers.
              </Text>
              <Text style={styles.ruleItem}>
                • <Text style={styles.cyanBold}>Início:</Text> Escolhe 3 das 6 cartas para ficarem à vista. Começa quem tiver a carta mais baixa sem poderes (4, 5, 6…).
              </Text>
              <Text style={styles.ruleItem}>
                • <Text style={styles.cyanBold}>Ordem:</Text> 4 5 6 7 8 9 J Q K A · 2, 3, 10 e Joker jogam-se sobre qualquer carta.
              </Text>
              <Text style={styles.ruleItem}>
                • <Text style={styles.cyanBold}>2 ↺:</Text> Reinicia o ciclo · <Text style={styles.cyanBold}>3 🪞:</Text> Espelho (copia a carta anterior).
              </Text>
              <Text style={styles.ruleItem}>
                • <Text style={styles.cyanBold}>7 ↕:</Text> Escolhes se o próximo joga acima ou abaixo de 7.
              </Text>
              <Text style={styles.ruleItem}>
                • <Text style={styles.cyanBold}>8 ⛔:</Text> Bloqueia o próximo jogador (nunca te bloqueia a ti próprio).
              </Text>
              <Text style={styles.ruleItem}>
                • <Text style={styles.cyanBold}>10, Joker e 4 Iguais 🧹:</Text> Limpam a mesa e jogas outra vez!
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.neonBtn, { marginTop: 16 }]}
              onPress={() => setRulesOpen(false)}
            >
              <Text style={styles.neonBtnTxt}>Entendido! 👍</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderResultsModal = () => {
    if (!resultsData || !sessionRef.current) return null;
    const sess = sessionRef.current;
    const mySeat = sess.role === 'local' ? 0 : sess.mySeats[0];
    const mine = resultsData.find((r) => r.seat === mySeat);
    const rw = REWARD[mine?.result || 'loss'];
    const sorted = [...resultsData].sort((a, b) => a.score - b.score);
    const winner = sess.players[sorted[0]?.seat ?? 0];

    return (
      <Modal visible={true} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 44 }}>🏆</Text>
            <Text style={styles.modalTitle}>{winner?.name} venceu!</Text>

            <View style={{ width: '100%', gap: 8, marginVertical: 10 }}>
              {sorted.map((r, idx) => {
                const p = sess.players[r.seat];
                return (
                  <View key={r.seat} style={styles.resRow}>
                    <Text style={styles.resPos}>{idx + 1}º</Text>
                    <AvatarView avatar={p.avatar} color={p.color} xp={p.xp} size={34} />
                    <Text style={styles.resName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text
                      style={{
                        color: r.result === 'win' ? COLORS.good : COLORS.bad,
                        fontWeight: '800',
                        fontSize: 12
                      }}
                    >
                      {r.result === 'win' ? 'Vitória' : `${r.score} cartas`}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.rewardBox}>
              <Text style={{ color: COLORS.cyan, fontWeight: '800' }}>+{rw.xp} XP</Text>
              <Text style={{ color: COLORS.warn, fontWeight: '800' }}>+{rw.coins} 🪙</Text>
            </View>

            <View style={styles.resActions}>
              {(!room || room.isHost) && (
                <TouchableOpacity
                  style={styles.neonBtn}
                  onPress={() => {
                    if (room && room.isHost) {
                      handleHostStartOnline();
                    } else {
                      handleStartLocal();
                    }
                  }}
                >
                  <Text style={styles.neonBtnTxt}>Jogar Outra Vez 🚀</Text>
                </TouchableOpacity>
              )}
              {room && (
                <TouchableOpacity style={styles.ghostBtn} onPress={backToLobby}>
                  <Text style={styles.ghostBtnTxt}>Voltar ao Lobby</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.ghostBtn} onPress={leaveAll}>
                <Text style={styles.ghostBtnTxt}>Sair para o Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  /* ============ ECRÃ 3: JOGO EM CURSO ============ */
  if (screen === 'game' && gameState && sessionRef.current) {
    const sess = sessionRef.current;
    return (
      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <View style={styles.gsBar}>
          <TouchableOpacity
            style={styles.ghostBtnSm}
            onPress={() => {
              if (room) backToLobby();
              else leaveAll();
            }}
          >
            <Text style={styles.ghostBtnTxt}>← Sair</Text>
          </TouchableOpacity>
          <Text style={styles.gsTitle}>🃏 Mexicana</Text>
          <View style={styles.roomChip}>
            <Text style={styles.roomChipTxt}>
              {room ? `🌐 Sala ${room.code}` : `📱 Local (${sess.players.length}J)`}
            </Text>
          </View>
        </View>

        <MexicanaBoard
          state={gameState}
          players={sess.players}
          mySeats={sess.mySeats}
          hotseat={sess.role === 'local'}
          onDispatch={(act, seat) => sess.dispatch(act, seat)}
          onOpenRules={() => setRulesOpen(true)}
        />

        {renderRulesModal()}
        {renderResultsModal()}
      </ScrollView>
    );
  }

  /* ============ ECRÃ 2: LOBBY DA SALA ONLINE ============ */
  if (screen === 'lobby' && room) {
    return (
      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <View style={styles.lobbyCard}>
          <Text style={styles.eyebrow}>SALA ONLINE · MEXICANA</Text>
          <View style={styles.codeRow}>
            {room.code.split('').map((ch, i) => (
              <View key={i} style={styles.codeDigitBox}>
                <Text style={styles.codeDigitTxt}>{ch}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.mutedSmall}>
            Partilha este código de 4 letras com os teus amigos para entrarem na mesa.
          </Text>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShareRoom}>
            <Text style={styles.shareBtnTxt}>📲 Partilhar Sala (WhatsApp / Sistema)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.lobbyCard}>
          <Text style={styles.secTitle}>
            Jogadores na Sala ({members.length}/{room.maxPlayers})
          </Text>
          <View style={{ gap: 8, width: '100%' }}>
            {Array.from({ length: room.maxPlayers }, (_, i) => {
              const m = members[i];
              if (m) {
                return (
                  <View key={m.key || i} style={styles.memberRow}>
                    <AvatarView avatar={m.avatar} color={m.color} xp={m.xp} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>
                        {m.name} {m.key === room.key ? '(tu)' : ''}
                      </Text>
                      <Text style={styles.mutedSmall}>
                        {m.isHost ? '👑 Anfitrião da Sala' : '✓ Pronto a jogar'}
                      </Text>
                    </View>
                  </View>
                );
              }
              return (
                <View key={i} style={[styles.memberRow, styles.memberEmpty]}>
                  <View style={styles.emptySlotCircle}>
                    <Text style={{ color: COLORS.muted }}>+</Text>
                  </View>
                  <Text style={styles.mutedSmall}>Lugar disponível…</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.lobbyActions}>
            <TouchableOpacity style={styles.ghostBtn} onPress={leaveAll}>
              <Text style={styles.ghostBtnTxt}>← Sair da Sala</Text>
            </TouchableOpacity>
            {room.isHost ? (
              <TouchableOpacity
                style={[styles.neonBtn, members.length < 2 && { opacity: 0.45 }]}
                disabled={members.length < 2}
                onPress={handleHostStartOnline}
              >
                <Text style={styles.neonBtnTxt}>Começar Partida 🚀</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.mutedSmall}>À espera que o anfitrião inicie…</Text>
            )}
          </View>
        </View>

        {/* Convidar Amigos Diretamente do Lobby */}
        <View style={styles.lobbyCard}>
          <Text style={styles.secTitle}>👥 Convidar Jogador para esta Sala</Text>
          <View style={styles.joinRow}>
            <TextInput
              style={[styles.codeInput, { letterSpacing: 0.5, fontSize: 14, textAlign: 'left' }]}
              placeholder="@username (site ou app)"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              value={inviteUname}
              onChangeText={setInviteUname}
            />
            <TouchableOpacity style={styles.neonBtn} onPress={handleLobbyInviteByUsername}>
              <Text style={styles.neonBtnTxt}>Convidar 📨</Text>
            </TouchableOpacity>
          </View>

          {friends.length === 0 ? (
            <TouchableOpacity style={styles.ghostBtn} onPress={onOpenFriends}>
              <Text style={styles.ghostBtnTxt}>+ Adicionar Amigos</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: '100%', gap: 8 }}>
              {friends.map((f) => {
                const p = f.profile;
                const isOnline =
                  (p.id ? Backend.onlineIds.has(p.id) : false) ||
                  (p.username ? Backend.onlineIds.has(p.username.toLowerCase()) : false);
                const inRoom = members.some(
                  (m) => (m.userId && m.userId === p.id) || (m.uid && m.uid === p.id)
                );
                const targetKey = p.id || p.username;
                const sent = targetKey ? invitedIds.has(targetKey) : false;
                return (
                  <View key={p.id || p.username} style={styles.inviteRow}>
                    <AvatarView avatar={p.avatar} color={p.color} xp={p.xp} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{p.display_name || p.username}</Text>
                      <Text style={{ color: isOnline ? COLORS.good : COLORS.muted, fontSize: 11 }}>
                        {inRoom ? '✓ Já na sala' : isOnline ? '● Online agora' : '○ Offline'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.neonBtnSm,
                        (inRoom || sent) && { backgroundColor: 'rgba(255,255,255,0.1)' }
                      ]}
                      disabled={inRoom || sent || !targetKey}
                      onPress={() =>
                        targetKey &&
                        handleLobbyInviteFriend(targetKey, p.display_name || p.username)
                      }
                    >
                      <Text
                        style={[
                          styles.neonBtnSmTxt,
                          (inRoom || sent) && { color: COLORS.text }
                        ]}
                      >
                        {inRoom ? 'Na sala' : sent ? 'Enviado ✓' : 'Convidar 📨'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  /* ============ ECRÃ 1: CONFIGURAÇÃO (ONLINE / LOCAL) ============ */
  return (
    <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
      <View style={styles.setupCard}>
        <View style={styles.setupHead}>
          <View style={styles.setupIconBox}>
            <Text style={{ fontSize: 32 }}>🃏</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.setupTitle}>Mexicana</Text>
            <Text style={styles.mutedSmall}>
              2 a 6 jogadores · 56 cartas (com 4 Jokers) · poderes especiais e mesa animada
            </Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, setupTab === 'online' && styles.tabBtnActive]}
            onPress={() => setSetupTab('online')}
          >
            <Text style={[styles.tabTxt, setupTab === 'online' && styles.tabTxtActive]}>
              🌐 Jogar Online
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, setupTab === 'local' && styles.tabBtnActive]}
            onPress={() => setSetupTab('local')}
          >
            <Text style={[styles.tabTxt, setupTab === 'local' && styles.tabTxtActive]}>
              📱 Mesmo Dispositivo
            </Text>
          </TouchableOpacity>
        </View>

        {setupTab === 'online' ? (
          <View style={{ gap: 14 }}>
            {!Backend.account && (
              <View style={styles.loginCallout}>
                <Text style={{ fontSize: 26 }}>🔑</Text>
                <Text style={styles.secTitle}>Entra na tua conta para jogar online</Text>
                <Text style={[styles.mutedSmall, { textAlign: 'center' }]}>
                  Ganha XP, compete no ranking e desafia os teus amigos à distância.
                </Text>
                <TouchableOpacity style={styles.neonBtn} onPress={onOpenAuth}>
                  <Text style={styles.neonBtnTxt}>Entrar / Criar Conta Grátis</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Criar Sala Online */}
            <View style={styles.modeCard}>
              <Text style={{ fontSize: 26 }}>🚀</Text>
              <Text style={styles.secTitle}>Criar Sala Online</Text>
              <Text style={styles.mutedSmall}>
                Cria uma sala privada e partilha o código ou convida amigos.
              </Text>
              <Text style={styles.fieldLabel}>LIMITE DE JOGADORES NA SALA:</Text>
              <View style={styles.pillsRow}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.pillBtn, onlineMax === n && styles.pillBtnOn]}
                    onPress={() => setOnlineMax(n)}
                  >
                    <Text style={[styles.pillBtnTxt, onlineMax === n && styles.pillBtnTxtOn]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.neonBtn, { width: '100%' }, busy && { opacity: 0.6 }]}
                disabled={busy}
                onPress={handleCreateRoom}
              >
                <Text style={styles.neonBtnTxt}>Criar Nova Sala 🎲</Text>
              </TouchableOpacity>
            </View>

            {/* Entrar numa Sala */}
            <View style={styles.modeCard}>
              <Text style={{ fontSize: 26 }}>🔑</Text>
              <Text style={styles.secTitle}>Entrar numa Sala</Text>
              <Text style={styles.mutedSmall}>Tens o código de 4 letras de um amigo?</Text>
              <View style={styles.joinRow}>
                <TextInput
                  style={styles.codeInput}
                  placeholder="CÓDIGO"
                  placeholderTextColor={COLORS.muted}
                  maxLength={4}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={joinCode}
                  onChangeText={(t) => setJoinCode(t.toUpperCase())}
                />
                <TouchableOpacity
                  style={[styles.neonBtn, busy && { opacity: 0.6 }]}
                  disabled={busy}
                  onPress={() => handleJoinRoom()}
                >
                  <Text style={styles.neonBtnTxt}>Entrar ▸</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Desafiar Amigos Online */}
            <View style={styles.modeCard}>
              <Text style={styles.secTitle}>👥 Desafiar Amigos Online</Text>
              <Text style={styles.mutedSmall}>
                Convida amigos diretamente para uma sala de Mexicana.
              </Text>
              {!Backend.account ? (
                <Text style={styles.mutedSmall}>Inicia sessão para veres os teus amigos.</Text>
              ) : friends.length === 0 ? (
                <TouchableOpacity style={styles.ghostBtn} onPress={onOpenFriends}>
                  <Text style={styles.ghostBtnTxt}>+ Adicionar Amigos</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: '100%', gap: 8, marginTop: 4 }}>
                  {friends.map((f) => {
                    const p = f.profile;
                    const isOnline = p.id ? Backend.onlineIds.has(p.id) : false;
                    return (
                      <View key={p.id || p.username} style={styles.inviteRow}>
                        <AvatarView avatar={p.avatar} color={p.color} xp={p.xp} size={36} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{p.display_name || p.username}</Text>
                          <Text
                            style={{ color: isOnline ? COLORS.good : COLORS.muted, fontSize: 11 }}
                          >
                            {isOnline ? '● Online agora' : '○ Offline'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.neonBtnSm}
                          disabled={busy || !p.id}
                          onPress={() => p.id && handleCreateAndInvite(p.id)}
                        >
                          <Text style={styles.neonBtnSmTxt}>Convidar 🃏</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        ) : (
          /* Aba 2: Mesmo Dispositivo (Local) */
          <View style={{ gap: 14 }}>
            <Text style={styles.fieldLabel}>NÚMERO DE JOGADORES</Text>
            <View style={styles.pillsRow}>
              {[2, 3, 4, 5, 6].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.pillBtn, localN === n && styles.pillBtnOn]}
                  onPress={() => setLocalN(n)}
                >
                  <Text style={[styles.pillBtnTxt, localN === n && styles.pillBtnTxtOn]}>
                    {n}J
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>NOMES DOS JOGADORES</Text>
            <View style={{ gap: 8 }}>
              {Array.from({ length: localN }, (_, i) => (
                <View
                  key={i}
                  style={[styles.nameRow, { borderColor: PCOL[i % PCOL.length] }]}
                >
                  <View
                    style={[styles.nameDot, { backgroundColor: PCOL[i % PCOL.length] }]}
                  />
                  <TextInput
                    style={styles.nameInput}
                    value={localNames[i]}
                    maxLength={18}
                    placeholder={`Jogador ${i + 1}`}
                    placeholderTextColor={COLORS.muted}
                    onChangeText={(txt) => {
                      const next = [...localNames];
                      next[i] = txt;
                      setLocalNames(next);
                    }}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.neonBtn} onPress={handleStartLocal}>
              <Text style={styles.neonBtnTxt}>Começar Partida Local ▸</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => setRulesOpen(true)}>
            <Text style={styles.ghostBtnTxt}>📖 Regras</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={onBackToHub}>
            <Text style={styles.ghostBtnTxt}>← Voltar ao Hub</Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderRulesModal()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollPad: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: 'center'
  },
  setupCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: COLORS.panel,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 18,
    gap: 16
  },
  setupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  setupIconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(244, 114, 182, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.5)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  setupTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800'
  },
  mutedSmall: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 4
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  tabBtnActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.4)'
  },
  tabTxt: {
    color: COLORS.muted,
    fontWeight: '600',
    fontSize: 13
  },
  tabTxtActive: {
    color: COLORS.text,
    fontWeight: '800'
  },
  loginCallout: {
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    padding: 16,
    alignItems: 'center',
    gap: 8
  },
  modeCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 16,
    gap: 8,
    alignItems: 'flex-start'
  },
  secTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800'
  },
  fieldLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 4
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%'
  },
  pillBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pillBtnOn: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
    borderColor: COLORS.cyan
  },
  pillBtnTxt: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800'
  },
  pillBtnTxtOn: {
    color: COLORS.cyan
  },
  joinRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 4
  },
  codeInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 4
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.panelBorder
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  nameDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  nameInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 8
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4
  },
  lobbyCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: COLORS.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 18,
    alignItems: 'center',
    gap: 12,
    marginBottom: 14
  },
  eyebrow: {
    color: COLORS.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center'
  },
  codeDigitBox: {
    width: 52,
    height: 64,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5,
    borderColor: COLORS.pink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  codeDigitTxt: {
    color: '#fbcfe8',
    fontSize: 28,
    fontWeight: '900'
  },
  shareBtn: {
    width: '100%',
    backgroundColor: 'rgba(37, 211, 102, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.45)',
    paddingVertical: 11,
    borderRadius: 13,
    alignItems: 'center'
  },
  shareBtnTxt: {
    color: '#4ade80',
    fontWeight: '800',
    fontSize: 13
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.panelBorder
  },
  memberEmpty: {
    borderStyle: 'dashed',
    opacity: 0.6
  },
  emptySlotCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  memberName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700'
  },
  lobbyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 6
  },
  gsBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8
  },
  gsTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800'
  },
  roomChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(244, 114, 182, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.45)'
  },
  roomChipTxt: {
    color: '#fbcfe8',
    fontSize: 11,
    fontWeight: '700'
  },
  neonBtn: {
    backgroundColor: COLORS.cyan,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  neonBtnTxt: {
    color: '#04121a',
    fontSize: 14,
    fontWeight: '800'
  },
  neonBtnSm: {
    backgroundColor: COLORS.cyan,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11
  },
  neonBtnSmTxt: {
    color: '#04121a',
    fontSize: 12,
    fontWeight: '800'
  },
  ghostBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 13,
    alignItems: 'center'
  },
  ghostBtnSm: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10
  },
  ghostBtnTxt: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,4,8,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    backgroundColor: '#10131f',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 20
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10
  },
  ruleItem: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19
  },
  cyanBold: {
    color: COLORS.cyan,
    fontWeight: '800'
  },
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 13,
    padding: 10
  },
  resPos: {
    color: COLORS.muted,
    fontWeight: '800',
    width: 24
  },
  resName: {
    color: COLORS.text,
    fontWeight: '700',
    flex: 1
  },
  rewardBox: {
    flexDirection: 'row',
    gap: 18,
    backgroundColor: 'rgba(34,211,238,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    marginVertical: 8
  },
  resActions: {
    width: '100%',
    gap: 8,
    marginTop: 8
  }
});

