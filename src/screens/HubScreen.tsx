import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet
} from 'react-native';
import { COLORS, AVATARS, FRAMES, levelInfo } from '../theme';
import { Backend, UserProfile, MatchHistoryItem } from '../services/backend';
import { AvatarView } from '../components/AvatarView';

interface HubScreenProps {
  subTab: 'hub' | 'ranking' | 'profile';
  onChangeSubTab: (t: 'hub' | 'ranking' | 'profile') => void;
  onOpenMexicana: () => void;
  onOpenFriends: () => void;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

export const HubScreen: React.FC<HubScreenProps> = ({
  subTab,
  onChangeSubTab,
  onOpenMexicana,
  onOpenFriends,
  onOpenAuth,
  onToast
}) => {
  const [me, setMe] = useState<UserProfile>(Backend.me());
  const [leaders, setLeaders] = useState<UserProfile[]>([]);
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [editModal, setEditModal] = useState(false);
  const [rouletteModal, setRouletteModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAv, setEditAv] = useState('🎮');
  const [editHue, setEditHue] = useState(190);

  useEffect(() => {
    const refresh = () => setMe({ ...Backend.me() });
    const unsub1 = Backend.on('profile', refresh);
    const unsub2 = Backend.on('auth', refresh);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  useEffect(() => {
    if (subTab === 'ranking') {
      Backend.getLeaderboard()
        .then((r) => setLeaders(r.data || []))
        .catch(() => {});
    } else if (subTab === 'profile') {
      Backend.getHistory(me.id)
        .then((r) => setHistory(r.data || []))
        .catch(() => {});
    }
  }, [subTab, me.id]);

  const openEditProfile = () => {
    const cur = Backend.me();
    setEditName(cur.display_name || cur.username);
    setEditBio(cur.bio || '');
    setEditAv(cur.avatar || AVATARS[0]);
    setEditHue(cur.color ?? 190);
    setEditModal(true);
  };

  const saveProfile = async () => {
    try {
      await Backend.updateProfile({
        display_name: editName.trim() || me.username,
        bio: editBio.trim(),
        avatar: editAv,
        color: editHue
      });
      setEditModal(false);
      onToast('Perfil atualizado com sucesso! ✨');
    } catch (e: any) {
      onToast(e?.message || 'Erro ao guardar perfil.');
    }
  };

  const lvl = levelInfo(me.xp);

  if (subTab === 'ranking') {
    return (
      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>🏆 Ranking Global</Text>
        <Text style={styles.pageSub}>Os jogadores com mais XP no universo OmniPlay.</Text>

        <View style={{ gap: 10, marginTop: 14 }}>
          {leaders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyTxt}>Ainda sem dados de ranking.</Text>
            </View>
          ) : (
            leaders.map((u, idx) => {
              const uLvl = levelInfo(u.xp);
              const isMe = u.id && u.id === me.id;
              return (
                <View
                  key={u.id || u.username || idx}
                  style={[
                    styles.rankRow,
                    idx === 0 && styles.rankRowFirst,
                    isMe && styles.rankRowMe
                  ]}
                >
                  <Text style={styles.rankPos}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                  </Text>
                  <AvatarView avatar={u.avatar} color={u.color} xp={u.xp} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rankName} numberOfLines={1}>
                      {u.display_name || u.username}
                    </Text>
                    <Text style={styles.rankSub}>@{u.username}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rankLvl}>Nv. {uLvl.level}</Text>
                    <Text style={styles.rankXp}>{u.xp || 0} XP</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    );
  }

  if (subTab === 'profile') {
    return (
      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <AvatarView avatar={me.avatar} color={me.color} xp={me.xp} size={74} />
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{me.display_name || me.username}</Text>
              <Text style={styles.profileTag}>
                @{me.username} · <Text style={{ color: COLORS.warn }}>🪙 {me.coins || 0}</Text>
              </Text>
              <Text style={styles.profileBio}>{me.bio || 'Jogador do OmniPlay 🚀'}</Text>
            </View>
          </View>

          <View style={styles.xpRow}>
            <Text style={styles.xpLvlTxt}>Nível {lvl.level}</Text>
            <View style={styles.xpBarTrack}>
              <View style={[styles.xpBarFill, { width: `${lvl.pct}%` }]} />
            </View>
            <Text style={styles.xpNumTxt}>
              {lvl.cur}/{lvl.need} XP
            </Text>
          </View>

          <View style={styles.profileActions}>
            <TouchableOpacity style={styles.ghostBtn} onPress={openEditProfile}>
              <Text style={styles.ghostBtnTxt}>✏️ Editar Perfil</Text>
            </TouchableOpacity>
            {!Backend.account ? (
              <TouchableOpacity style={styles.neonBtnSm} onPress={onOpenAuth}>
                <Text style={styles.neonBtnSmTxt}>🔑 Entrar / Criar Conta</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.dangerBtnSm}
                onPress={async () => {
                  await Backend.signOut();
                  onToast('Sessão terminada.');
                }}
              >
                <Text style={styles.dangerBtnTxt}>Sair da Conta</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.secHeading}>MOLDURAS DE NÍVEL</Text>
        <View style={styles.framesCard}>
          {FRAMES.map((fr) => {
            const unlocked = lvl.level >= fr.min;
            return (
              <View
                key={fr.cls}
                style={[styles.frameRow, !unlocked && { opacity: 0.4 }]}
              >
                <AvatarView avatar={me.avatar} color={me.color} xp={fr.min === 1 ? 0 : 100 * (fr.min - 1) ** 2} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.frameName}>{fr.name}</Text>
                  <Text style={styles.frameSub}>Desbloqueia no Nível {fr.min}</Text>
                </View>
                <Text style={{ color: unlocked ? COLORS.good : COLORS.muted, fontWeight: '700', fontSize: 12 }}>
                  {unlocked ? '✓ Ativa' : '🔒'}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.secHeading}>HISTÓRICO RECENTE</Text>
        <View style={{ gap: 8 }}>
          {history.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTxt}>Ainda não tens partidas registadas.</Text>
            </View>
          ) : (
            history.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.histRow,
                  {
                    borderLeftColor:
                      h.result === 'win'
                        ? COLORS.good
                        : h.result === 'loss'
                          ? COLORS.bad
                          : COLORS.warn
                  }
                ]}
              >
                <Text style={{ fontSize: 22 }}>🃏</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histTitle}>Mexicana ({h.mode === 'online' ? 'Online' : 'Local'})</Text>
                  <Text style={styles.histSub}>
                    {h.players?.map((p) => p.name).join(', ') || 'Partida'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      color:
                        h.result === 'win'
                          ? COLORS.good
                          : h.result === 'loss'
                            ? COLORS.bad
                            : COLORS.warn,
                      fontWeight: '800',
                      fontSize: 12
                    }}
                  >
                    {h.result === 'win' ? 'VITÓRIA' : h.result === 'loss' ? 'DERROTA' : 'EMPATE'}
                  </Text>
                  <Text style={styles.histSub}>+{h.xp_gain || 15} XP</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Editar Perfil</Text>
              <Text style={styles.fieldLabel}>NOME DE EXIBIÇÃO</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                maxLength={20}
              />
              <Text style={styles.fieldLabel}>BIO</Text>
              <TextInput
                style={styles.input}
                value={editBio}
                onChangeText={setEditBio}
                maxLength={80}
              />
              <Text style={styles.fieldLabel}>AVATAR</Text>
              <View style={styles.avGrid}>
                {AVATARS.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.avOpt, editAv === a && styles.avOptSel]}
                    onPress={() => setEditAv(a)}
                  >
                    <Text style={{ fontSize: 18 }}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => setEditModal(false)}>
                  <Text style={styles.ghostBtnTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.neonBtnSm} onPress={saveProfile}>
                  <Text style={styles.neonBtnSmTxt}>Guardar ✓</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>MULTIVERSO DE JOGOS</Text>
        <Text style={styles.heroTitle}>
          Todos os jogos.{'\n'}
          <Text style={styles.heroGrad}>Um só universo.</Text>
        </Text>
        <Text style={styles.heroLead}>
          Joga online com amigos, ou no mesmo dispositivo. Sem internet? Também funciona.
        </Text>

        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.rouletteBtn} onPress={() => setRouletteModal(true)}>
            <Text style={styles.rouletteBtnTxt}>🎲 Roleta Omni</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={onOpenFriends}>
            <Text style={styles.ghostBtnTxt}>👥 Adicionar Amigos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Portal Card Principal: Mexicana */}
      <TouchableOpacity activeOpacity={0.88} style={styles.portalCard} onPress={onOpenMexicana}>
        <View style={styles.portalRings}>
          <View style={styles.portalRingOuter} />
          <View style={styles.portalRingInner} />
          <Text style={styles.portalIcon}>🃏</Text>
        </View>
        <Text style={styles.portalName}>Mexicana</Text>
        <Text style={styles.portalDesc}>
          Livra-te de todas as cartas: 3 escondidas, 3 à vista e muitos poderes.
        </Text>
        <View style={styles.portalTag}>
          <Text style={styles.portalTagTxt}>2–6 JOGADORES · ONLINE & LOCAL</Text>
        </View>
      </TouchableOpacity>

      {/* Cartão de Informação Rápida */}
      <View style={styles.gameInfoCard}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.giTitle}>🃏 Mexicana</Text>
          <Text style={styles.giDesc}>
            52 cartas + 4 Jokers · Poderes especiais (2, 3, 7, 8, 10 e Joker) e mesa animada em tempo real.
          </Text>
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>🧑‍🤝‍🧑 2–6 jogadores</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>🌐 Salas Online</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>📱 Mesmo Telemóvel</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.playBigBtn} onPress={onOpenMexicana}>
          <Text style={styles.playBigBtnTxt}>Jogar ▸</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Roleta Omni */}
      <Modal
        visible={rouletteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRouletteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 54, marginBottom: 8 }}>🃏</Text>
            <Text style={styles.modalTitle}>A sorte escolheu: Mexicana!</Text>
            <Text style={[styles.pageSub, { textAlign: 'center', marginBottom: 16 }]}>
              Prepara os Jokers e limpa a mesa antes dos teus amigos!
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setRouletteModal(false)}>
                <Text style={styles.ghostBtnTxt}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.neonBtnSm}
                onPress={() => {
                  setRouletteModal(false);
                  onOpenMexicana();
                }}
              >
                <Text style={styles.neonBtnSmTxt}>Jogar Agora 🚀</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollPad: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 38,
    alignItems: 'center'
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
    width: '100%'
  },
  eyebrow: {
    color: COLORS.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 36
  },
  heroGrad: {
    color: COLORS.cyan
  },
  heroLead: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 20
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 6
  },
  rouletteBtn: {
    backgroundColor: '#ec4899',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 99,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5
  },
  rouletteBtnTxt: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14
  },
  ghostBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14
  },
  ghostBtnTxt: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13
  },
  portalCard: {
    width: 256,
    borderRadius: 28,
    backgroundColor: '#1f0c24',
    borderWidth: 1.5,
    borderColor: 'rgba(244, 114, 182, 0.55)',
    padding: 22,
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    shadowColor: '#f472b6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8
  },
  portalRings: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  portalRingOuter: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(244, 114, 182, 0.5)'
  },
  portalRingInner: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: 'rgba(244, 114, 182, 0.35)',
    backgroundColor: 'rgba(244, 114, 182, 0.1)'
  },
  portalIcon: {
    fontSize: 56
  },
  portalName: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800'
  },
  portalDesc: {
    color: '#cbd5e1',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  },
  portalTag: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(244, 114, 182, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.45)'
  },
  portalTagTxt: {
    color: '#fbcfe8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7
  },
  gameInfoCard: {
    width: '100%',
    backgroundColor: COLORS.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.3)',
    padding: 18,
    marginTop: 16,
    gap: 14
  },
  giTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '800'
  },
  giDesc: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder
  },
  chipTxt: {
    color: '#cfd5e5',
    fontSize: 11,
    fontWeight: '600'
  },
  playBigBtn: {
    backgroundColor: COLORS.cyan,
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: 'center'
  },
  playBigBtnTxt: {
    color: '#04121a',
    fontSize: 16,
    fontWeight: '800'
  },
  pageTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    alignSelf: 'flex-start'
  },
  pageSub: {
    color: COLORS.muted,
    fontSize: 13,
    alignSelf: 'flex-start',
    marginTop: 2
  },
  rankRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    borderRadius: 16,
    padding: 12
  },
  rankRowFirst: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.4)'
  },
  rankRowMe: {
    borderColor: COLORS.cyan
  },
  rankPos: {
    width: 32,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center'
  },
  rankName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700'
  },
  rankSub: {
    color: COLORS.muted,
    fontSize: 12
  },
  rankLvl: {
    color: COLORS.cyan,
    fontWeight: '700',
    fontSize: 13
  },
  rankXp: {
    color: COLORS.muted,
    fontSize: 12
  },
  profileCard: {
    width: '100%',
    backgroundColor: COLORS.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 18,
    gap: 14
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  profileName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800'
  },
  profileTag: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 2
  },
  profileBio: {
    color: '#cfd5e5',
    fontSize: 13,
    marginTop: 4
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  xpLvlTxt: {
    color: COLORS.cyan,
    fontWeight: '800',
    fontSize: 13
  },
  xpBarTrack: {
    flex: 1,
    height: 9,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden'
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: COLORS.cyan,
    borderRadius: 99
  },
  xpNumTxt: {
    color: COLORS.muted,
    fontSize: 11
  },
  profileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  neonBtnSm: {
    backgroundColor: COLORS.cyan,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 13
  },
  neonBtnSmTxt: {
    color: '#04121a',
    fontWeight: '800',
    fontSize: 13
  },
  dangerBtnSm: {
    backgroundColor: 'rgba(251, 113, 133, 0.16)',
    borderWidth: 1,
    borderColor: COLORS.bad,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 13
  },
  dangerBtnTxt: {
    color: COLORS.bad,
    fontWeight: '700',
    fontSize: 13
  },
  secHeading: {
    alignSelf: 'flex-start',
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 10
  },
  framesCard: {
    width: '100%',
    backgroundColor: COLORS.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 14,
    gap: 12
  },
  frameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  frameName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700'
  },
  frameSub: {
    color: COLORS.muted,
    fontSize: 12
  },
  histRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 15,
    padding: 12,
    borderLeftWidth: 3
  },
  histTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700'
  },
  histSub: {
    color: COLORS.muted,
    fontSize: 12
  },
  emptyCard: {
    width: '100%',
    backgroundColor: COLORS.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 24,
    alignItems: 'center',
    gap: 6
  },
  emptyIcon: { fontSize: 32 },
  emptyTxt: { color: COLORS.muted, fontSize: 13, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,4,8,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#10131f',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 20
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 10
  },
  fieldLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 6
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    marginBottom: 8
  },
  avGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8
  },
  avOpt: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avOptSel: {
    borderWidth: 1.5,
    borderColor: COLORS.cyan,
    backgroundColor: 'rgba(34,211,238,0.18)'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14
  }
});

