import React, { useState, useEffect } from 'react';
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
import { COLORS, levelInfo } from '../theme';
import { Backend, FriendItem, UserProfile, MatchHistoryItem } from '../services/backend';
import { AvatarView } from '../components/AvatarView';

interface FriendsScreenProps {
  onBackToHub: () => void;
  onChallengeFriend: (friendId: string) => void;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

export const FriendsScreen: React.FC<FriendsScreenProps> = ({
  onBackToHub,
  onChallengeFriend,
  onOpenAuth,
  onToast
}) => {
  const [me, setMe] = useState<UserProfile>(Backend.me());
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [incoming, setIncoming] = useState<FriendItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState<boolean>(false);

  // H2H Modal state
  const [h2hFriend, setH2hFriend] = useState<UserProfile | null>(null);
  const [h2hData, setH2hData] = useState<{
    myWins: number;
    theirWins: number;
    total: number;
    matches: MatchHistoryItem[];
  } | null>(null);
  const [h2hLoading, setH2hLoading] = useState<boolean>(false);

  const loadFriends = async () => {
    setMe({ ...Backend.me() });
    if (!Backend.account) return;
    setLoading(true);
    try {
      const res = await Backend.getFriends();
      setFriends(res.friends);
      setIncoming(res.incoming);
      setOutgoing(res.outgoing);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFriends();
    const u1 = Backend.on('auth', loadFriends);
    const u2 = Backend.on('profile', loadFriends);
    const u3 = Backend.on('presence', loadFriends);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  useEffect(() => {
    if (tab !== 'search') return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await Backend.searchUsers(searchQuery.trim());
        setSearchResults(res);
      } finally {
        setSearching(false);
      }
    }, 240);
    return () => clearTimeout(t);
  }, [searchQuery, tab]);

  const handleShareProfile = async () => {
    const u = Backend.me();
    try {
      await Share.share({
        message: `Adiciona-me no OmniPlay! O meu utilizador é @${u.username} 🎮🃏`
      });
    } catch {
      // ignore
    }
  };

  const handleSendRequest = async (targetUser: UserProfile) => {
    const res = await Backend.sendRequest(targetUser.id);
    if (!res.ok) {
      onToast(res.error || 'Erro ao enviar pedido');
      return;
    }
    onToast(`Pedido de amizade enviado a ${targetUser.display_name}! ✨`);
    loadFriends();
  };

  const handleAccept = async (item: FriendItem) => {
    const res = await Backend.acceptRequest(item.friendshipId);
    if (!res.ok) {
      onToast(res.error || 'Erro ao aceitar pedido');
      return;
    }
    onToast(`Agora és amigo de ${item.profile.display_name}! 🎉`);
    loadFriends();
  };

  const handleRemove = async (item: FriendItem, msg = 'Amizade removida') => {
    await Backend.removeFriendship(item.friendshipId);
    onToast(msg);
    loadFriends();
  };

  const openH2H = async (friendProfile: UserProfile) => {
    setH2hFriend(friendProfile);
    setH2hData(null);
    setH2hLoading(true);
    try {
      const stats = await Backend.getH2H(friendProfile.id);
      setH2hData(stats);
    } finally {
      setH2hLoading(false);
    }
  };

  if (!Backend.account) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.guestHeroCard}>
          <Text style={styles.guestEmoji}>👥</Text>
          <Text style={styles.guestTitle}>Joga com os teus Amigos</Text>
          <Text style={styles.guestSub}>
            Cria uma conta gratuita ou entra na tua conta para adicionar amigos, ver quem está online em tempo real, comparar histórico Head-to-Head e enviar convites diretos para a Mexicana!
          </Text>
          <View style={styles.guestActionRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={onOpenAuth}>
              <Text style={styles.primaryBtnTxt}>Entrar / Criar Conta ✨</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={onBackToHub}>
              <Text style={styles.ghostBtnTxt}>← Voltar ao Hub</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  const lv = levelInfo(me.xp || 0);

  const relationStatus = (userId: string): {
    type: 'none' | 'friend' | 'incoming' | 'outgoing';
    item?: FriendItem;
  } => {
    const f = friends.find((x) => x.profile.id === userId);
    if (f) return { type: 'friend', item: f };
    const inc = incoming.find((x) => x.profile.id === userId);
    if (inc) return { type: 'incoming', item: inc };
    const out = outgoing.find((x) => x.profile.id === userId);
    if (out) return { type: 'outgoing', item: out };
    return { type: 'none' };
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Personal Share Banner */}
      <View style={styles.myShareCard}>
        <View style={styles.myShareLeft}>
          <AvatarView
            avatar={me.avatar}
            hue={me.avatar_hue}
            frame={me.frame}
            size={56}
            online={true}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.myShareLabel}>O TEU CARTÃO OMNIPLAY</Text>
            <Text style={styles.myShareName} numberOfLines={1}>
              {me.display_name}
            </Text>
            <Text style={styles.myShareHandle}>
              @{me.username} · Nível {lv.level}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareProfile}>
          <Text style={styles.shareBtnTxt}>📤 Partilhar</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'friends' && styles.tabBtnActive]}
          onPress={() => setTab('friends')}
        >
          <Text style={[styles.tabBtnTxt, tab === 'friends' && styles.tabBtnTxtActive]}>
            👥 Amigos ({friends.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'requests' && styles.tabBtnActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[styles.tabBtnTxt, tab === 'requests' && styles.tabBtnTxtActive]}>
            🔔 Pedidos
          </Text>
          {incoming.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{incoming.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'search' && styles.tabBtnActive]}
          onPress={() => setTab('search')}
        >
          <Text style={[styles.tabBtnTxt, tab === 'search' && styles.tabBtnTxtActive]}>
            🔍 Procurar
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: FRIENDS LIST */}
      {tab === 'friends' && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Os Teus Amigos</Text>
            <TouchableOpacity onPress={loadFriends}>
              <Text style={styles.refreshLink}>{loading ? 'A atualizar…' : '↻ Atualizar'}</Text>
            </TouchableOpacity>
          </View>

          {friends.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🤝</Text>
              <Text style={styles.emptyTitle}>Ainda não tens amigos adicionados</Text>
              <Text style={styles.emptySub}>
                Procura jogadores pelo @utilizador e convida-os para partidas online de Mexicana!
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 12 }]}
                onPress={() => setTab('search')}
              >
                <Text style={styles.primaryBtnTxt}>🔍 Procurar Jogadores</Text>
              </TouchableOpacity>
            </View>
          ) : (
            friends.map((item) => {
              const p = item.profile;
              const flv = levelInfo(p.xp || 0);
              return (
                <View key={item.friendshipId} style={styles.friendRow}>
                  <AvatarView
                    avatar={p.avatar}
                    hue={p.avatar_hue}
                    frame={p.frame}
                    size={48}
                    online={item.online}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.friendNameRow}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {p.display_name}
                      </Text>
                      <View
                        style={[
                          styles.statusPill,
                          item.online ? styles.statusPillOn : styles.statusPillOff
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillTxt,
                            item.online ? { color: COLORS.emerald } : { color: COLORS.muted }
                          ]}
                        >
                          {item.online ? '● Online' : 'Offline'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.friendMeta}>
                      @{p.username} · Nv.{flv.level} · 🏆 {p.wins || 0} vitórias
                    </Text>
                  </View>

                  <View style={styles.friendActions}>
                    <TouchableOpacity
                      style={styles.challengeBtn}
                      onPress={() => onChallengeFriend(p.id)}
                    >
                      <Text style={styles.challengeBtnTxt}>🃏 Desafiar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.h2hBtn} onPress={() => openH2H(p)}>
                      <Text style={styles.h2hBtnTxt}>⚔️ H2H</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemove(item, `Removeste ${p.display_name}`)}
                    >
                      <Text style={styles.removeBtnTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* TAB 2: REQUESTS */}
      {tab === 'requests' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pedidos Recebidos ({incoming.length})</Text>
          {incoming.length === 0 ? (
            <View style={styles.emptySmall}>
              <Text style={styles.emptySmallTxt}>Nenhum pedido pendente neste momento.</Text>
            </View>
          ) : (
            incoming.map((item) => {
              const p = item.profile;
              return (
                <View key={item.friendshipId} style={styles.friendRow}>
                  <AvatarView avatar={p.avatar} hue={p.avatar_hue} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{p.display_name}</Text>
                    <Text style={styles.friendMeta}>@{p.username} quer ser teu amigo</Text>
                  </View>
                  <View style={styles.friendActions}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleAccept(item)}
                    >
                      <Text style={styles.acceptBtnTxt}>✓ Aceitar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemove(item, 'Pedido recusado')}
                    >
                      <Text style={styles.removeBtnTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
            Pedidos Enviados ({outgoing.length})
          </Text>
          {outgoing.length === 0 ? (
            <View style={styles.emptySmall}>
              <Text style={styles.emptySmallTxt}>Não tens pedidos enviados pendentes.</Text>
            </View>
          ) : (
            outgoing.map((item) => {
              const p = item.profile;
              return (
                <View key={item.friendshipId} style={styles.friendRow}>
                  <AvatarView avatar={p.avatar} hue={p.avatar_hue} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{p.display_name}</Text>
                    <Text style={styles.friendMeta}>@{p.username} · A aguardar resposta…</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.ghostSmallBtn}
                    onPress={() => handleRemove(item, 'Pedido cancelado')}
                  >
                    <Text style={styles.ghostSmallBtnTxt}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* TAB 3: SEARCH USERS */}
      {tab === 'search' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Procurar Jogadores</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Escreve o @utilizador ou nome do teu amigo…"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
          />
          {searching && <Text style={styles.searchingTxt}>A procurar jogadores…</Text>}

          {searchResults.length === 0 && !searching ? (
            <View style={styles.emptySmall}>
              <Text style={styles.emptySmallTxt}>
                Nenhum jogador encontrado com esse nome.
              </Text>
            </View>
          ) : (
            searchResults.map((u) => {
              const rel = relationStatus(u.id);
              const ulv = levelInfo(u.xp || 0);
              return (
                <View key={u.id} style={styles.friendRow}>
                  <AvatarView
                    avatar={u.avatar}
                    hue={u.avatar_hue}
                    frame={u.frame}
                    size={44}
                    online={Backend.isOnline(u.id)}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName} numberOfLines={1}>
                      {u.display_name}
                    </Text>
                    <Text style={styles.friendMeta}>
                      @{u.username} · Nv.{ulv.level} · 🏆 {u.wins || 0} vitórias
                    </Text>
                  </View>

                  {rel.type === 'friend' && (
                    <TouchableOpacity
                      style={styles.challengeBtn}
                      onPress={() => onChallengeFriend(u.id)}
                    >
                      <Text style={styles.challengeBtnTxt}>🃏 Desafiar</Text>
                    </TouchableOpacity>
                  )}
                  {rel.type === 'incoming' && rel.item && (
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleAccept(rel.item!)}
                    >
                      <Text style={styles.acceptBtnTxt}>✓ Aceitar</Text>
                    </TouchableOpacity>
                  )}
                  {rel.type === 'outgoing' && (
                    <View style={styles.pendingChip}>
                      <Text style={styles.pendingChipTxt}>⏳ Pendente</Text>
                    </View>
                  )}
                  {rel.type === 'none' && (
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => handleSendRequest(u)}
                    >
                      <Text style={styles.addBtnTxt}>➕ Adicionar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* HEAD-TO-HEAD MODAL */}
      <Modal
        visible={!!h2hFriend}
        transparent
        animationType="fade"
        onRequestClose={() => setH2hFriend(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚔️ Frente-a-Frente (H2H)</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setH2hFriend(null)}
              >
                <Text style={styles.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {h2hFriend && (
              <>
                <View style={styles.h2hVersusRow}>
                  <View style={styles.h2hSide}>
                    <AvatarView avatar={me.avatar} hue={me.avatar_hue} size={54} />
                    <Text style={styles.h2hName} numberOfLines={1}>
                      {me.display_name}
                    </Text>
                    <Text style={[styles.h2hScore, { color: COLORS.cyan }]}>
                      {h2hData ? h2hData.myWins : '—'}
                    </Text>
                    <Text style={styles.h2hScoreLbl}>VITÓRIAS</Text>
                  </View>

                  <View style={styles.h2hCenter}>
                    <Text style={styles.h2hVsBadge}>VS</Text>
                    <Text style={styles.h2hTotalTxt}>
                      {h2hData ? `${h2hData.total} jogos juntos` : 'A carregar…'}
                    </Text>
                  </View>

                  <View style={styles.h2hSide}>
                    <AvatarView
                      avatar={h2hFriend.avatar}
                      hue={h2hFriend.avatar_hue}
                      size={54}
                    />
                    <Text style={styles.h2hName} numberOfLines={1}>
                      {h2hFriend.display_name}
                    </Text>
                    <Text style={[styles.h2hScore, { color: COLORS.pink }]}>
                      {h2hData ? h2hData.theirWins : '—'}
                    </Text>
                    <Text style={styles.h2hScoreLbl}>VITÓRIAS</Text>
                  </View>
                </View>

                {h2hLoading ? (
                  <Text style={styles.searchingTxt}>A calcular histórico de confrontos…</Text>
                ) : (
                  h2hData && (
                    <View style={{ marginTop: 12 }}>
                      <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => {
                          const fId = h2hFriend.id;
                          setH2hFriend(null);
                          onChallengeFriend(fId);
                        }}
                      >
                        <Text style={styles.primaryBtnTxt}>
                          🃏 Desafiar {h2hFriend.display_name} Agora
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 44,
    gap: 16
  },
  guestHeroCard: {
    backgroundColor: 'rgba(18, 22, 36, 0.94)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    gap: 10
  },
  guestEmoji: {
    fontSize: 44
  },
  guestTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center'
  },
  guestSub: {
    color: COLORS.textDim,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center'
  },
  guestActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    justifyContent: 'center'
  },
  myShareCard: {
    backgroundColor: 'rgba(18, 22, 36, 0.94)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 224, 255, 0.28)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  myShareLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  myShareLabel: {
    color: COLORS.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1
  },
  myShareName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900'
  },
  myShareHandle: {
    color: COLORS.textDim,
    fontSize: 12
  },
  shareBtn: {
    backgroundColor: 'rgba(56, 224, 255, 0.14)',
    borderWidth: 1,
    borderColor: COLORS.cyan,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12
  },
  shareBtnTxt: {
    color: COLORS.cyan,
    fontWeight: '800',
    fontSize: 12
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10
  },
  tabBtnActive: {
    backgroundColor: 'rgba(56, 224, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 224, 255, 0.35)'
  },
  tabBtnTxt: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700'
  },
  tabBtnTxtActive: {
    color: COLORS.text,
    fontWeight: '900'
  },
  badge: {
    backgroundColor: COLORS.rose,
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  badgeTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900'
  },
  section: {
    gap: 10
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900'
  },
  refreshLink: {
    color: COLORS.cyan,
    fontSize: 12,
    fontWeight: '700'
  },
  emptyCard: {
    backgroundColor: 'rgba(18, 22, 36, 0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    gap: 6
  },
  emptyEmoji: {
    fontSize: 36
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center'
  },
  emptySub: {
    color: COLORS.textDim,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18
  },
  emptySmall: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: 'center'
  },
  emptySmallTxt: {
    color: COLORS.muted,
    fontSize: 12
  },
  friendRow: {
    backgroundColor: 'rgba(18, 22, 36, 0.92)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap'
  },
  friendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  friendName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800'
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99
  },
  statusPillOn: {
    backgroundColor: 'rgba(34, 211, 153, 0.14)'
  },
  statusPillOff: {
    backgroundColor: 'rgba(255,255,255,0.04)'
  },
  statusPillTxt: {
    fontSize: 10,
    fontWeight: '800'
  },
  friendMeta: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 2
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  challengeBtn: {
    backgroundColor: COLORS.cyan,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10
  },
  challengeBtnTxt: {
    color: '#050811',
    fontSize: 11,
    fontWeight: '900'
  },
  h2hBtn: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10
  },
  h2hBtnTxt: {
    color: '#d8b4fe',
    fontSize: 11,
    fontWeight: '800'
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 113, 133, 0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeBtnTxt: {
    color: COLORS.rose,
    fontSize: 12,
    fontWeight: '900'
  },
  acceptBtn: {
    backgroundColor: COLORS.emerald,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10
  },
  acceptBtnTxt: {
    color: '#04120c',
    fontSize: 12,
    fontWeight: '900'
  },
  addBtn: {
    backgroundColor: 'rgba(56, 224, 255, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.cyan,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10
  },
  addBtnTxt: {
    color: COLORS.cyan,
    fontSize: 11,
    fontWeight: '800'
  },
  pendingChip: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10
  },
  pendingChipTxt: {
    color: COLORS.amber,
    fontSize: 11,
    fontWeight: '700'
  },
  ghostSmallBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10
  },
  ghostSmallBtnTxt: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '700'
  },
  searchInput: {
    backgroundColor: 'rgba(7, 8, 13, 0.85)',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14
  },
  searchingTxt: {
    color: COLORS.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 8
  },
  primaryBtn: {
    backgroundColor: COLORS.cyan,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  primaryBtnTxt: {
    color: '#050811',
    fontWeight: '900',
    fontSize: 13
  },
  ghostBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  ghostBtnTxt: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 6, 12, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121624',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeTxt: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: '800'
  },
  h2hVersusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  h2hSide: {
    alignItems: 'center',
    flex: 1,
    gap: 4
  },
  h2hName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4
  },
  h2hScore: {
    fontSize: 28,
    fontWeight: '900'
  },
  h2hScoreLbl: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1
  },
  h2hCenter: {
    alignItems: 'center',
    paddingHorizontal: 10
  },
  h2hVsBadge: {
    color: COLORS.amber,
    fontSize: 16,
    fontWeight: '900'
  },
  h2hTotalTxt: {
    color: COLORS.textDim,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center'
  }
});

