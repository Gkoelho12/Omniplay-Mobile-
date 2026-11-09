import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StyleSheet
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { COLORS, levelInfo } from './src/theme';
import { Backend, UserProfile, InvitePayload } from './src/services/backend';
import { StarfieldBackground } from './src/components/StarfieldBackground';
import { AvatarView } from './src/components/AvatarView';
import { AuthModal } from './src/components/AuthModal';
import { HubScreen } from './src/screens/HubScreen';
import { MexicanaScreen } from './src/screens/MexicanaScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';

type MainRoute = 'hub' | 'mexicana' | 'friends';
type HubSubTab = 'hub' | 'ranking' | 'profile';

export default function App() {
  const [ready, setReady] = useState<boolean>(false);
  const [route, setRoute] = useState<MainRoute>('hub');
  const [hubSubTab, setHubSubTab] = useState<HubSubTab>('hub');
  const [me, setMe] = useState<UserProfile>(Backend.me());
  const [authVisible, setAuthVisible] = useState<boolean>(false);

  // Room & Challenge deep-navigation state
  const [initialRoomCode, setInitialRoomCode] = useState<string | null>(null);
  const [challengeFriendId, setChallengeFriendId] = useState<string | null>(null);

  // Live incoming invite banner
  const [liveInvite, setLiveInvite] = useState<InvitePayload | null>(null);

  // Toast notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.spring(toastAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 80
    }).start();

    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true
      }).start(() => setToastMsg(null));
    }, 3200);
  };

  useEffect(() => {
    let mounted = true;
    Backend.init().then(() => {
      if (!mounted) return;
      setMe({ ...Backend.me() });
      setReady(true);
    });

    const uAuth = Backend.on('auth', () => setMe({ ...Backend.me() }));
    const uProf = Backend.on('profile', () => setMe({ ...Backend.me() }));
    const uInv = Backend.on('invite', (payload: InvitePayload) => {
      setLiveInvite(payload);
    });

    return () => {
      mounted = false;
      uAuth();
      uProf();
      uInv();
    };
  }, []);

  const lv = levelInfo(me.xp || 0);

  const handleOpenHubTab = (sub: HubSubTab) => {
    setRoute('hub');
    setHubSubTab(sub);
  };

  const handleAcceptInvite = (inv: InvitePayload) => {
    setLiveInvite(null);
    setInitialRoomCode(inv.room);
    setChallengeFriendId(null);
    setRoute('mexicana');
  };

  const handleChallengeFriend = (friendId: string) => {
    setChallengeFriendId(friendId);
    setInitialRoomCode(null);
    setRoute('mexicana');
  };

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingScreen}>
          <StatusBar style="light" />
          <StarfieldBackground />
          <View style={styles.brandMarkLarge}>
            <Text style={styles.brandMarkTxtLarge}>◆</Text>
          </View>
          <Text style={styles.loadingTitle}>OmniPlay</Text>
          <Text style={styles.loadingSub}>A ligar ao servidor em tempo real…</Text>
          <ActivityIndicator size="large" color={COLORS.cyan} style={{ marginTop: 14 }} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        <StarfieldBackground />

        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {/* TOPBAR */}
          <View style={styles.topbar}>
            <View style={styles.topbarMainRow}>
              <TouchableOpacity
                style={styles.brandRow}
                onPress={() => handleOpenHubTab('hub')}
                activeOpacity={0.8}
              >
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkTxt}>◆</Text>
                </View>
                <View>
                  <Text style={styles.brandName}>OmniPlay</Text>
                  <Text style={styles.brandTag}>MOBILE ARENA</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.userPill}
                onPress={() => {
                  if (Backend.account) {
                    handleOpenHubTab('profile');
                  } else {
                    setAuthVisible(true);
                  }
                }}
                activeOpacity={0.85}
              >
                <AvatarView
                  avatar={me.avatar}
                  color={me.color}
                  xp={me.xp}
                  size={30}
                />
                <View style={{ maxWidth: 110 }}>
                  <Text style={styles.userPillName} numberOfLines={1}>
                    {me.display_name}
                  </Text>
                  <Text style={styles.userPillSub}>
                    {Backend.account ? `Nv. ${lv.level} · ⭐ ${me.xp || 0}` : 'Entrar / Conta'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* NAVIGATION PILLS */}
            <View style={styles.navBar}>
              <TouchableOpacity
                style={[
                  styles.navLink,
                  route === 'hub' && hubSubTab === 'hub' && styles.navLinkActive
                ]}
                onPress={() => handleOpenHubTab('hub')}
              >
                <Text
                  style={[
                    styles.navLinkTxt,
                    route === 'hub' && hubSubTab === 'hub' && styles.navLinkTxtActive
                  ]}
                >
                  🏠 Hub
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navLink, route === 'mexicana' && styles.navLinkActive]}
                onPress={() => setRoute('mexicana')}
              >
                <Text
                  style={[styles.navLinkTxt, route === 'mexicana' && styles.navLinkTxtActive]}
                >
                  🃏 Mexicana
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navLink, route === 'friends' && styles.navLinkActive]}
                onPress={() => setRoute('friends')}
              >
                <Text
                  style={[styles.navLinkTxt, route === 'friends' && styles.navLinkTxtActive]}
                >
                  👥 Amigos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navLink,
                  route === 'hub' && hubSubTab === 'ranking' && styles.navLinkActive
                ]}
                onPress={() => handleOpenHubTab('ranking')}
              >
                <Text
                  style={[
                    styles.navLinkTxt,
                    route === 'hub' && hubSubTab === 'ranking' && styles.navLinkTxtActive
                  ]}
                >
                  🏆 Ranking
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navLink,
                  route === 'hub' && hubSubTab === 'profile' && styles.navLinkActive
                ]}
                onPress={() => handleOpenHubTab('profile')}
              >
                <Text
                  style={[
                    styles.navLinkTxt,
                    route === 'hub' && hubSubTab === 'profile' && styles.navLinkTxtActive
                  ]}
                >
                  👤 Perfil
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* LIVE GAME INVITE BANNER */}
          {liveInvite && (
            <View style={styles.inviteBanner}>
              <AvatarView
                avatar={liveInvite.from.avatar}
                color={liveInvite.from.color}
                size={38}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteTitle} numberOfLines={1}>
                  🃏 {liveInvite.from.display_name} convidou-te!
                </Text>
                <Text style={styles.inviteSub}>
                  Sala Online #{liveInvite.room} · {liveInvite.game || 'Mexicana'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.inviteAcceptBtn}
                onPress={() => handleAcceptInvite(liveInvite)}
              >
                <Text style={styles.inviteAcceptTxt}>Entrar ▸</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inviteDismissBtn}
                onPress={() => setLiveInvite(null)}
              >
                <Text style={styles.inviteDismissTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* MAIN SCREEN CONTENT */}
          <View style={styles.contentArea}>
            {route === 'hub' && (
              <HubScreen
                subTab={hubSubTab}
                onChangeSubTab={(t) => setHubSubTab(t)}
                onOpenMexicana={() => setRoute('mexicana')}
                onOpenFriends={() => setRoute('friends')}
                onOpenAuth={() => setAuthVisible(true)}
                onToast={showToast}
              />
            )}

            {route === 'mexicana' && (
              <MexicanaScreen
                initialRoomCode={initialRoomCode}
                challengeFriendId={challengeFriendId}
                onClearInitialParams={() => {
                  setInitialRoomCode(null);
                  setChallengeFriendId(null);
                }}
                onBackToHub={() => handleOpenHubTab('hub')}
                onOpenFriends={() => setRoute('friends')}
                onOpenAuth={() => setAuthVisible(true)}
                onToast={showToast}
              />
            )}

            {route === 'friends' && (
              <FriendsScreen
                onBackToHub={() => handleOpenHubTab('hub')}
                onChallengeFriend={handleChallengeFriend}
                onOpenAuth={() => setAuthVisible(true)}
                onToast={showToast}
              />
            )}
          </View>

          {/* AUTH MODAL */}
          <AuthModal
            visible={authVisible}
            onClose={() => setAuthVisible(false)}
            onSuccess={(msg) => {
              setMe({ ...Backend.me() });
              showToast(msg);
            }}
          />

          {/* TOAST OVERLAY */}
          {toastMsg && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.toastWrap,
                {
                  opacity: toastAnim,
                  transform: [
                    {
                      translateY: toastAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0]
                      })
                    }
                  ]
                }
              ]}
            >
              <View style={styles.toastBox}>
                <Text style={styles.toastTxt}>{toastMsg}</Text>
              </View>
            </Animated.View>
          )}
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  safeArea: {
    flex: 1
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  brandMarkLarge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  brandMarkTxtLarge: {
    color: '#040812',
    fontSize: 32,
    fontWeight: '900'
  },
  loadingTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  loadingSub: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 4
  },
  topbar: {
    backgroundColor: 'rgba(11, 14, 24, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.panelBorder,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8
  },
  topbarMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.cyan,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandMarkTxt: {
    color: '#050811',
    fontSize: 18,
    fontWeight: '900'
  },
  brandName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  brandTag: {
    color: COLORS.cyan,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    borderRadius: 99,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  userPillName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800'
  },
  userPillSub: {
    color: COLORS.cyan,
    fontSize: 10,
    fontWeight: '700'
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.panelBorder
  },
  navLink: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  navLinkActive: {
    backgroundColor: 'rgba(56, 224, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 224, 255, 0.35)'
  },
  navLinkTxt: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700'
  },
  navLinkTxtActive: {
    color: COLORS.text,
    fontWeight: '900'
  },
  inviteBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: 'rgba(18, 26, 46, 0.98)',
    borderWidth: 1.5,
    borderColor: COLORS.cyan,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  inviteTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900'
  },
  inviteSub: {
    color: COLORS.cyan,
    fontSize: 11,
    fontWeight: '700'
  },
  inviteAcceptBtn: {
    backgroundColor: COLORS.cyan,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  inviteAcceptTxt: {
    color: '#040812',
    fontSize: 12,
    fontWeight: '900'
  },
  inviteDismissBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  inviteDismissTxt: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '800'
  },
  contentArea: {
    flex: 1
  },
  toastWrap: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: 'center'
  },
  toastBox: {
    backgroundColor: 'rgba(14, 18, 30, 0.96)',
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: 99,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6
  },
  toastTxt: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center'
  }
});
