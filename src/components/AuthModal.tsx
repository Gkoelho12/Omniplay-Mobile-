import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet
} from 'react-native';
import { COLORS, AVATARS } from '../theme';
import { Backend } from '../services/backend';
import { AvatarView } from './AvatarView';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const HUE_PRESETS = [190, 265, 330, 28, 145, 48, 215, 0];

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [avIdx, setAvIdx] = useState(0);
  const [hue, setHue] = useState(190);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const savedAccounts = Backend.getSavedAccounts();

  const handleSubmit = async () => {
    setErr('');
    setLoading(true);
    try {
      if (tab === 'login') {
        const u = await Backend.signIn(username, password);
        onSuccess(`Bem-vindo de volta, ${u.display_name || u.username}! 🚀`);
        onClose();
      } else {
        const u = await Backend.signUp(
          username,
          password,
          displayName.trim() || username.trim(),
          AVATARS[avIdx],
          hue
        );
        onSuccess(`Conta criada! Olá, ${u.display_name || u.username}! 🎉`);
        onClose();
      }
    } catch (e: any) {
      setErr(e?.message || 'Erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.head}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoTxt}>🃏</Text>
              </View>
              <Text style={styles.title}>Passaporte OmniPlay</Text>
              <Text style={styles.subtitle}>
                Inicia sessão para guardar o teu nível, moedas e jogar online com amigos.
              </Text>
              <View style={styles.modeBadge}>
                <View style={styles.dotOn} />
                <Text style={styles.modeBadgeTxt}>Servidor Online Supabase</Text>
              </View>
            </View>

            {savedAccounts.length > 0 && (
              <View style={styles.savedBox}>
                <Text style={styles.savedLabel}>Contas neste telemóvel:</Text>
                <View style={styles.savedRow}>
                  {savedAccounts.map((acc) => (
                    <TouchableOpacity
                      key={acc.username}
                      style={styles.savedChip}
                      onPress={() => {
                        setUsername(acc.username);
                        setTab('login');
                      }}
                    >
                      <Text>{acc.avatar}</Text>
                      <Text style={styles.savedChipTxt}>@{acc.username}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
                onPress={() => {
                  setTab('login');
                  setErr('');
                }}
              >
                <Text style={[styles.tabTxt, tab === 'login' && styles.tabTxtActive]}>
                  🔑 Iniciar Sessão
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'register' && styles.tabBtnActive]}
                onPress={() => {
                  setTab('register');
                  setErr('');
                }}
              >
                <Text style={[styles.tabTxt, tab === 'register' && styles.tabTxtActive]}>
                  ✨ Criar Conta
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>USERNAME</Text>
            <TextInput
              style={styles.input}
              placeholder="ex.: jogador_1"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={16}
              value={username}
              onChangeText={setUsername}
            />

            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={styles.passRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="mínimo 4 caracteres"
                placeholderTextColor={COLORS.muted}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {tab === 'register' && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>NOME DE EXIBIÇÃO (OPCIONAL)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="O teu nome nas salas"
                  placeholderTextColor={COLORS.muted}
                  maxLength={20}
                  value={displayName}
                  onChangeText={setDisplayName}
                />

                <View style={styles.previewRow}>
                  <AvatarView avatar={AVATARS[avIdx]} color={hue} xp={0} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewName}>
                      {displayName.trim() || username.trim() || '@jogador'}
                    </Text>
                    <Text style={styles.previewSub}>Nível 1 · Guardado na nuvem</Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>ESCOLHE O TEU AVATAR</Text>
                <View style={styles.avGrid}>
                  {AVATARS.map((av, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.avCell, i === avIdx && styles.avCellSel]}
                      onPress={() => setAvIdx(i)}
                    >
                      <Text style={{ fontSize: 20 }}>{av}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>COR DA AURA</Text>
                <View style={styles.hueRow}>
                  {HUE_PRESETS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.hueDot,
                        { backgroundColor: `hsl(${h}, 75%, 45%)` },
                        hue === h && styles.hueDotSel
                      ]}
                      onPress={() => setHue(h)}
                    />
                  ))}
                </View>
              </View>
            )}

            {!!err && <Text style={styles.errTxt}>{err}</Text>}

            <TouchableOpacity
              style={[styles.neonBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.neonBtnTxt}>
                {loading
                  ? 'A processar…'
                  : tab === 'login'
                    ? 'Entrar no OmniPlay 🚀'
                    : 'Criar Conta e Jogar 🎉'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.guestBtn} onPress={onClose}>
              <Text style={styles.guestBtnTxt}>🎮 Continuar como Convidado</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 4, 8, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: '#0e111b',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
    padding: 20
  },
  head: {
    alignItems: 'center',
    marginBottom: 14
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    borderWidth: 2,
    borderColor: COLORS.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  logoTxt: { fontSize: 28 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.cyan,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 4
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)'
  },
  dotOn: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.good
  },
  modeBadgeTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.good
  },
  savedBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.panelBorder
  },
  savedLabel: { fontSize: 11, color: COLORS.muted, marginBottom: 6 },
  savedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)'
  },
  savedChipTxt: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center'
  },
  tabBtnActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.4)'
  },
  tabTxt: { color: COLORS.muted, fontWeight: '600', fontSize: 13 },
  tabTxtActive: { color: COLORS.text, fontWeight: '700' },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 12
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  eyeBtn: {
    padding: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.panelBorder
  },
  previewName: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  previewSub: { color: COLORS.muted, fontSize: 12 },
  avGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12
  },
  avCell: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  avCellSel: {
    borderColor: COLORS.cyan,
    backgroundColor: 'rgba(34, 211, 238, 0.2)'
  },
  hueRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap'
  },
  hueDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  hueDotSel: {
    borderColor: '#fff',
    transform: [{ scale: 1.12 }]
  },
  errTxt: {
    color: COLORS.bad,
    fontSize: 13,
    marginVertical: 6,
    textAlign: 'center',
    fontWeight: '600'
  },
  neonBtn: {
    backgroundColor: COLORS.cyan,
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8
  },
  neonBtnTxt: {
    color: '#04121a',
    fontSize: 15,
    fontWeight: '800'
  },
  guestBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    alignItems: 'center'
  },
  guestBtnTxt: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600'
  }
});

