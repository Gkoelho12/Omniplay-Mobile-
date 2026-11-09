import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  StyleSheet
} from 'react-native';
import { COLORS, PCOL } from '../theme';
import { SessionPlayer } from '../services/session';
import {
  MexicanaState,
  MexicanaEvent,
  rk,
  su,
  SUITS,
  GLYPH,
  ORDER_NAME,
  SEVEN,
  byOrder,
  effTop,
  validPlay
} from '../games/mexicanaEngine';
import { AvatarView } from './AvatarView';

interface MexicanaBoardProps {
  state: MexicanaState;
  players: SessionPlayer[];
  mySeats: number[];
  hotseat: boolean;
  onDispatch: (action: any, seat: number) => void;
  onOpenRules: () => void;
}

const PARTICLE_ANGLES = Array.from({ length: 12 }, (_, i) => (Math.PI * 2 * i) / 12);

export const MexicanaBoard: React.FC<MexicanaBoardProps> = ({
  state: s,
  players,
  mySeats,
  hotseat,
  onDispatch,
  onOpenRules
}) => {
  const [selected, setSelected] = useState<number[]>([]);
  const [unlockedSeat, setUnlockedSeat] = useState<number>(0);
  const [bannerInfo, setBannerInfo] = useState<{
    title: string;
    sub?: string;
    color: string;
    emojis: string[];
  } | null>(null);
  const [flyingCards, setFlyingCards] = useState<{
    cards: number[];
    fromTop: boolean;
    toDiscard?: boolean;
  } | null>(null);
  const [blockedSet, setBlockedSet] = useState<Set<number>>(new Set());
  const [blindFlip, setBlindFlip] = useState<{
    id: number;
    ok: boolean;
    seatName: string;
  } | null>(null);
  const [tableCleaning, setTableCleaning] = useState(false);

  const lastEvtId = useRef<number>(-1);
  const lastTurnKey = useRef<string>('');

  const flyAnim = useRef(new Animated.Value(0)).current;
  const shockAnim = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 0, duration: 1800, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ringPulse]);

  const viewSeat = (): number => {
    if (!hotseat) return mySeats[0] ?? 0;
    if (s.phase === 'setup') {
      const k = s.ready.findIndex((r) => !r);
      return k < 0 ? 0 : k;
    }
    if (s.phase === 'start') return s.starters[0] ?? 0;
    if (s.phase === 'over') return s.winner >= 0 ? s.winner : 0;
    return s.turn;
  };

  const v = viewSeat();
  const locked = hotseat && s.phase !== 'over' && v !== unlockedSeat;

  useEffect(() => {
    const tKey = `${s.phase}:${s.turn}:${s.pending}:${v}`;
    if (tKey !== lastTurnKey.current) {
      lastTurnKey.current = tKey;
      setSelected([]);
    } else {
      setSelected((prev) => prev.filter((id) => s.hands[v]?.includes(id)));
    }
  }, [s.phase, s.turn, s.pending, v, s.hands]);

  const triggerBanner = (title: string, color: string, emojis: string[], sub?: string) => {
    setBannerInfo({ title, sub, color, emojis });
    bannerAnim.setValue(0);
    particleAnim.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(bannerAnim, { toValue: 1, friction: 6, tension: 85, useNativeDriver: true }),
        Animated.delay(1150),
        Animated.timing(bannerAnim, { toValue: 0, duration: 240, useNativeDriver: true })
      ]),
      Animated.timing(particleAnim, {
        toValue: 1,
        duration: 950,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(() => setBannerInfo(null));
  };

  const triggerShockwave = () => {
    shockAnim.setValue(0);
    Animated.timing(shockAnim, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  };

  const triggerCardFlight = (cards: number[], fromTop: boolean, toDiscard = false) => {
    setFlyingCards({ cards: cards.slice(0, 4), fromTop, toDiscard });
    flyAnim.setValue(0);
    Animated.timing(flyAnim, {
      toValue: 1,
      duration: 440,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true
    }).start(() => {
      setFlyingCards(null);
      triggerShockwave();
    });
  };

  useEffect(() => {
    if (!s.evt) return;
    if (lastEvtId.current === -1 && s.seq > 1) {
      lastEvtId.current = s.evt.id;
      return;
    }
    if (s.evt.id === lastEvtId.current) return;
    lastEvtId.current = s.evt.id;

    const evt: MexicanaEvent = s.evt;
    const fromTop = evt.seat !== v;

    if (evt.blind && evt.seat != null) {
      setBlindFlip({ id: evt.blind.id, ok: evt.blind.ok, seatName: s.names[evt.seat] });
      flipAnim.setValue(0);
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 680,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
      setTimeout(() => setBlindFlip(null), 1950);
    }

    if (evt.type === 'start') {
      triggerShockwave();
      triggerBanner(`⚡ Começa o ${evt.startRank}!`, COLORS.good, ['⚡', '🃏', '✨']);
      return;
    }

    if (evt.type === 'dir') {
      const isUp = evt.dir === 'up';
      triggerShockwave();
      triggerBanner(
        isUp ? '↑ ACIMA DE 7!' : '↓ ABAIXO DE 7!',
        isUp ? COLORS.cyan : COLORS.violet,
        isUp ? ['↑', '✨', '7'] : ['↓', '✨', '7']
      );
      return;
    }

    if (evt.type === 'end') {
      if (evt.blockedSeats?.length) {
        setBlockedSet(new Set(evt.blockedSeats));
        setTimeout(() => setBlockedSet(new Set()), 1800);
        triggerBanner(
          evt.blockedSeats.length > 1
            ? `⛔ ${evt.blockedSeats.length} JOGADORES BLOQUEADOS!`
            : `⛔ ${s.names[evt.blockedSeats[0]]} BLOQUEADO!`,
          COLORS.bad,
          ['⛔', '💥', '⚡']
        );
      }
      return;
    }

    if (evt.type === 'take' || evt.type === 'blind_fail') {
      if (evt.taken?.length) {
        triggerCardFlight(evt.taken, !fromTop, false);
      }
      if (evt.seat != null) {
        triggerBanner(
          `📥 ${s.names[evt.seat]} recolheu ${evt.taken?.length || 1} carta(s)!`,
          COLORS.bad,
          ['📥', '🃏', '💨']
        );
      }
      return;
    }

    if (evt.type === 'clean') {
      if (evt.cards?.length) {
        triggerCardFlight(evt.cards, fromTop, true);
      }
      setTableCleaning(true);
      setTimeout(() => setTableCleaning(false), 1100);
      const title =
        evt.cleanKind === 'joker'
          ? '🃏 JOKER! MESA LIMPA!'
          : evt.cleanKind === 'four'
            ? '🔥 4 IGUAIS! MESA LIMPA!'
            : '🧹 10! MESA LIMPA!';
      const sub = evt.seat != null ? `${s.names[evt.seat]} joga outra vez!` : undefined;
      triggerBanner(title, COLORS.cyan, ['🧹', '🃏', '🔥', '✨', '⚡'], sub);
      return;
    }

    if (evt.type === 'play') {
      if (evt.cards?.length) {
        triggerCardFlight(evt.cards, fromTop, false);
      }
      if (evt.blockedSeats?.length) {
        setBlockedSet(new Set(evt.blockedSeats));
        setTimeout(() => setBlockedSet(new Set()), 1800);
        triggerBanner(
          evt.blockedSeats.length > 1
            ? `⛔ ${evt.blockedSeats.length} BLOQUEADOS!`
            : `⛔ ${s.names[evt.blockedSeats[0]]} BLOQUEADO!`,
          COLORS.bad,
          ['⛔', '💥']
        );
      } else if (evt.power === 'reset') {
        triggerBanner('↺ CICLO REINICIADO!', COLORS.cyan, ['↺', '✨', '2']);
      } else if (evt.power === 'mirror') {
        triggerBanner('🪞 ESPELHO!', COLORS.violet, ['🪞', '✨', '3']);
      } else if (evt.lucky) {
        triggerBanner('✨ COMPRA IGUAL!', COLORS.cyan, ['✨', '🃏', '⭐'], 'Pode jogar por cima!');
      }
    }
  }, [s.evt, s.seq]);

  const toggleCard = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (s.phase === 'setup' && prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const renderCardFace = (
    id: number,
    opts: {
      small?: boolean;
      selected?: boolean;
      pulse?: boolean;
      mirror?: boolean;
      onPress?: () => void;
    } = {}
  ) => {
    const r = rk(id);
    const suitIdx = su(id);
    const isRed = suitIdx === 1 || suitIdx === 2;
    const isJoker = r === 'X';
    const glyph = GLYPH[r];
    const Wrapper: any = opts.onPress ? TouchableOpacity : View;

    return (
      <Wrapper
        key={id}
        activeOpacity={0.82}
        onPress={opts.onPress}
        style={[
          styles.card,
          opts.small && styles.cardSmall,
          isJoker && styles.cardJoker,
          opts.mirror && styles.cardMirror,
          opts.pulse && styles.cardPulse,
          opts.selected && styles.cardSelected
        ]}
      >
        {isJoker ? (
          <View style={styles.jokerInner}>
            <Text style={{ fontSize: opts.small ? 18 : 26 }}>🃏</Text>
            <Text style={[styles.jokerTxt, opts.small && { fontSize: 7 }]}>JOKER</Text>
          </View>
        ) : (
          <>
            <View style={styles.cardCornerTop}>
              <Text
                style={[
                  styles.cardRank,
                  opts.small && { fontSize: 10 },
                  isRed && styles.cardRedTxt
                ]}
              >
                {r}
              </Text>
              <Text
                style={[
                  styles.cardSuitMini,
                  opts.small && { fontSize: 9 },
                  isRed && styles.cardRedTxt
                ]}
              >
                {SUITS[suitIdx]}
              </Text>
            </View>
            {!!glyph && <Text style={[styles.cardGlyph, opts.small && { fontSize: 9 }]}>{glyph}</Text>}
            <Text
              style={[
                styles.cardBigSuit,
                opts.small && { fontSize: 16 },
                isRed && styles.cardRedTxt
              ]}
            >
              {SUITS[suitIdx]}
            </Text>
            <View style={styles.cardCornerBot}>
              <Text
                style={[
                  styles.cardRank,
                  opts.small && { fontSize: 10 },
                  isRed && styles.cardRedTxt
                ]}
              >
                {r}
              </Text>
            </View>
          </>
        )}
      </Wrapper>
    );
  };

  const renderCardBack = (opts: { small?: boolean; pickable?: boolean; onPress?: () => void } = {}) => {
    const Wrapper: any = opts.onPress ? TouchableOpacity : View;
    return (
      <Wrapper
        activeOpacity={0.8}
        onPress={opts.onPress}
        style={[
          styles.card,
          styles.cardBack,
          opts.small && styles.cardSmall,
          opts.pickable && styles.cardBackPick
        ]}
      >
        <View style={styles.cardBackInner}>
          <Text style={styles.cardBackStar}>✦</Text>
        </View>
      </Wrapper>
    );
  };

  const renderSlots = (seat: number, isMine: boolean, canPickBlind: boolean) => {
    const count = Math.max(s.hidden[seat].length, s.faceUp[seat].length);
    if (count === 0) {
      return <Text style={styles.noneTxt}>sem cartas na mesa</Text>;
    }
    return (
      <View style={styles.slotsRow}>
        {Array.from({ length: count }, (_, k) => {
          const hasHid = s.hidden[seat][k] != null;
          const faceId = s.faceUp[seat][k];
          return (
            <View key={k} style={[styles.slotBox, !isMine && styles.slotBoxSmall]}>
              {hasHid && (
                <View style={StyleSheet.absoluteFill}>
                  {renderCardBack({
                    small: !isMine,
                    pickable: canPickBlind,
                    onPress: canPickBlind ? () => onDispatch({ type: 'blind', idx: k }, v) : undefined
                  })}
                </View>
              )}
              {faceId != null && (
                <View style={{ transform: [{ translateY: hasHid ? -4 : 0 }] }}>
                  {renderCardFace(faceId, { small: !isMine })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const myTurn = s.phase === 'play' && s.turn === v;
  const blindPhase = s.phase === 'play' && !s.hands[v].length && !s.faceUp[v].length && !s.stock.length;
  const hand = [...s.hands[v]].sort(byOrder);
  const playGroup = selected.length ? validPlay(s, selected) : null;

  const needText = (): string => {
    const e = effTop(s.center);
    if (!s.center.length) return 'Mesa livre — joga qualquer carta';
    if (e == null) return 'Ciclo reiniciado (2) — joga qualquer carta';
    if (e === SEVEN && s.dir === 'down') return 'Abaixo de 7: joga 4, 5, 6 ou 7';
    if (e === SEVEN && s.dir === 'up') return 'Acima de 7: joga 7 ou superior';
    return `Joga ${ORDER_NAME[e]} ou superior · (2, 3, 10 e Joker passam sempre)`;
  };

  const rulePillText = (): string => {
    if (s.phase === 'setup') return '🂠 Preparação · Escolhe 3 cartas à vista';
    if (s.phase === 'start') return `⚡ Carta mais baixa (${s.startRank}) começa!`;
    if (s.phase === 'over') return '🏆 Partida Terminada';
    const e = effTop(s.center);
    if (!s.center.length) return '✨ Mesa Livre · Joga qualquer carta';
    if (e == null) return '↺ Ciclo Reiniciado (2) · Qualquer carta';
    if (e === SEVEN && s.pending === 'dir') return '↕ 7 na Mesa · A escolher Acima ou Abaixo…';
    if (e === SEVEN && s.dir === 'down') return '↓ Abaixo de 7 (4, 5, 6 ou 7)';
    if (e === SEVEN && s.dir === 'up') return '↑ Acima de 7 (7 ou maior)';
    const topId = s.center[s.center.length - 1];
    const isMirror = rk(topId) === '3';
    return `${isMirror ? '🪞 Espelho → ' : '🎯 Topo: '}${ORDER_NAME[e]} ou superior`;
  };

  let statusMsg = '';
  if (s.phase === 'setup') {
    statusMsg = s.ready[v]
      ? 'À espera dos outros jogadores…'
      : `Escolhe 3 cartas para ficarem viradas para cima na mesa (${selected.length}/3)`;
  } else if (s.phase === 'start') {
    statusMsg = s.starters.includes(v)
      ? `Tens a carta mais baixa (${s.startRank})! Joga-a primeiro!`
      : `${s.names[s.starters[0]]} tem a carta mais baixa (${s.startRank}) e vai começar…`;
  } else if (s.phase === 'over') {
    statusMsg = `🏆 ${s.names[s.winner]} ficou sem cartas e venceu!`;
  } else if (s.pending === 'dir') {
    statusMsg =
      s.turn === v
        ? 'Jogaste um 7: o próximo joga acima ou abaixo?'
        : `${s.names[s.turn]} está a escolher acima ou abaixo de 7…`;
  } else if (myTurn) {
    statusMsg = blindPhase
      ? 'Toca numa carta virada para baixo (ou pega as do meio)'
      : s.canEnd
        ? '✨ Carta igual ou 3! Podes jogar por cima ou terminar a jogada.'
        : `A tua vez! ${needText()}`;
  } else {
    statusMsg = s.canEnd
      ? `${s.names[s.turn]} pode jogar mais cartas iguais ou um 3…`
      : `Vez de ${s.names[s.turn]} · ${needText()}`;
  }

  const opps: number[] = [];
  for (let k = 1; k < s.n; k++) opps.push((v + k) % s.n);

  const activeTurnSeat =
    s.phase === 'play' ? s.turn : s.phase === 'start' && s.starters.length ? s.starters[0] : v;
  const turnColor = PCOL[activeTurnSeat % PCOL.length];
  const shownCenter = s.center.slice(-5);

  if (locked) {
    const p = players[v] || { name: s.names[v], avatar: '🎮', color: 190, xp: 0 };
    return (
      <View style={styles.coverBox}>
        <Text style={styles.coverLock}>🔒</Text>
        <AvatarView avatar={p.avatar} color={p.color} xp={p.xp} size={64} />
        <Text style={styles.coverTitle}>
          Passa o telemóvel a <Text style={{ color: PCOL[v % PCOL.length] }}>{p.name}</Text>
        </Text>
        <Text style={styles.coverSub}>Os outros jogadores não devem olhar para o ecrã.</Text>
        <TouchableOpacity style={styles.neonBtn} onPress={() => setUnlockedSeat(v)}>
          <Text style={styles.neonBtnTxt}>Ver as minhas cartas 🃏</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.boardWrap}>
      {/* Adversários no topo */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.oppsScroll}
      >
        {opps.map((seatIdx) => {
          const p = players[seatIdx] || { name: s.names[seatIdx], avatar: '🎮', color: 190, xp: 0 };
          const isTurn =
            (s.phase === 'play' && s.turn === seatIdx) ||
            (s.phase === 'start' && s.starters.includes(seatIdx));
          const isBlocked = blockedSet.has(seatIdx);
          const col = PCOL[seatIdx % PCOL.length];
          const miniCount = Math.min(s.hands[seatIdx].length, 6);

          return (
            <View
              key={seatIdx}
              style={[
                styles.oppCard,
                isTurn && { borderColor: col, backgroundColor: 'rgba(34,211,238,0.09)' }
              ]}
            >
              <View style={styles.oppHead}>
                <View style={styles.oppIdentity}>
                  <AvatarView avatar={p.avatar} color={p.color} xp={p.xp} size={24} />
                  <Text style={[styles.oppName, { color: col }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                </View>
                <Text style={styles.oppStat}>
                  {s.phase === 'setup'
                    ? s.ready[seatIdx]
                      ? '✓ pronto'
                      : 'a escolher…'
                    : `✋ ${s.hands[seatIdx].length}`}
                </Text>
              </View>

              {renderSlots(seatIdx, false, false)}

              <View style={styles.miniHandRow}>
                {Array.from({ length: miniCount }, (_, mi) => (
                  <View
                    key={mi}
                    style={[
                      styles.miniCardPip,
                      { transform: [{ rotate: `${(mi - (miniCount - 1) / 2) * 5}deg` }] }
                    ]}
                  />
                ))}
                {s.hands[seatIdx].length > 6 && (
                  <Text style={styles.miniMoreTxt}>+{s.hands[seatIdx].length - 6}</Text>
                )}
              </View>

              {isBlocked && (
                <View style={styles.blockStamp}>
                  <Text style={styles.blockStampTxt}>⛔ BLOQUEADO</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* MESA CENTRAL (Casino / Neon Arena) */}
      <View
        style={[
          styles.tableArena,
          { borderColor: tableCleaning ? COLORS.orange : turnColor },
          tableCleaning && styles.tableCleaning
        ]}
      >
        <View style={styles.tableInnerRim} pointerEvents="none" />

        {/* Pílula de regra ativa na mesa */}
        <View style={styles.rulePill}>
          <Text style={styles.rulePillTxt}>{rulePillText()}</Text>
        </View>

        <View style={styles.tableBody}>
          {/* Monte do Baralho */}
          <View style={styles.pileCol}>
            <View style={styles.pileBox}>
              {s.stock.length > 0 ? (
                <>
                  {s.stock.length > 8 && (
                    <View style={[styles.stackLayer, { top: 4, left: -4 }]} />
                  )}
                  {s.stock.length > 3 && (
                    <View style={[styles.stackLayer, { top: 2, left: -2 }]} />
                  )}
                  {renderCardBack({ small: true })}
                </>
              ) : (
                <View style={styles.emptyPileBox}>
                  <Text style={styles.emptyPileTxt}>∅</Text>
                </View>
              )}
            </View>
            <Text style={styles.pileLabel}>Baralho · {s.stock.length}</Text>
          </View>

          {/* Centro da Mesa */}
          <View style={styles.centerZone}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.targetRing,
                {
                  borderColor: turnColor,
                  transform: [
                    {
                      scale: ringPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1.07]
                      })
                    }
                  ]
                }
              ]}
            />

            {/* Onda de Choque ao Jogar / Limpar */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shockwave,
                {
                  borderColor: tableCleaning ? COLORS.orange : turnColor,
                  opacity: shockAnim.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0, 0.95, 0]
                  }),
                  transform: [
                    {
                      scale: shockAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 2.7]
                      })
                    }
                  ]
                }
              ]}
            />

            <View style={styles.centerCardsBox}>
              {shownCenter.length > 0 ? (
                shownCenter.map((cid, k) => (
                  <View
                    key={`${cid}-${k}`}
                    style={[
                      styles.centerStackedCard,
                      {
                        transform: [
                          { rotate: `${((cid * 7) % 11) - 5}deg` },
                          { translateY: -k * 2 }
                        ]
                      }
                    ]}
                  >
                    {renderCardFace(cid, { mirror: rk(cid) === '3' })}
                  </View>
                ))
              ) : (
                <View style={styles.emptyCenterBox}>
                  <Text style={{ fontSize: 18 }}>🃏</Text>
                  <Text style={styles.emptyCenterTxt}>Mesa livre</Text>
                </View>
              )}

              {/* Cartas em voo animado para a mesa */}
              {flyingCards && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.flyingCardWrap,
                    {
                      opacity: flyAnim.interpolate({
                        inputRange: [0, 0.15, 1],
                        outputRange: [0.2, 1, 1]
                      }),
                      transform: [
                        {
                          translateY: flyAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [flyingCards.fromTop ? -115 : 125, 0]
                          })
                        },
                        {
                          translateX: flyAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [flyingCards.toDiscard ? 55 : 0, 0]
                          })
                        },
                        {
                          scale: flyAnim.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0.72, 1.22, 1]
                          })
                        },
                        {
                          rotate: flyAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [flyingCards.fromTop ? '18deg' : '-16deg', '0deg']
                          })
                        }
                      ]
                    }
                  ]}
                >
                  {renderCardFace(flyingCards.cards[flyingCards.cards.length - 1])}
                </Animated.View>
              )}
            </View>

            <Text style={styles.centerCountTxt}>
              {s.center.length
                ? `${s.center.length} carta${s.center.length > 1 ? 's' : ''} na mesa`
                : 'Joga para o centro'}
            </Text>
          </View>

          {/* Monte de Cartas Limpas / Descartadas */}
          <View style={[styles.pileCol, !s.discard.length && { opacity: 0.6 }]}>
            <View style={styles.pileBox}>
              {s.discard.length > 0 ? (
                <>
                  {s.discard.length > 6 && (
                    <View style={[styles.stackLayer, { top: 3, left: -3 }]} />
                  )}
                  {renderCardBack({ small: true })}
                </>
              ) : (
                <View style={styles.emptyPileBox}>
                  <Text style={styles.emptyPileTxt}>🧹</Text>
                </View>
              )}
            </View>
            <Text style={styles.pileLabel}>Limpas · {s.discard.length}</Text>
          </View>
        </View>

        {/* Partículas e Banner de Evento sobre a Mesa */}
        {bannerInfo && (
          <View style={styles.fxOverlay} pointerEvents="none">
            {PARTICLE_ANGLES.map((angle, idx) => {
              const dist = 68 + (idx % 3) * 24;
              const tx = Math.cos(angle) * dist;
              const ty = Math.sin(angle) * dist;
              return (
                <Animated.Text
                  key={idx}
                  style={[
                    styles.particleEmoji,
                    {
                      opacity: particleAnim.interpolate({
                        inputRange: [0, 0.2, 0.8, 1],
                        outputRange: [0, 1, 1, 0]
                      }),
                      transform: [
                        {
                          translateX: particleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, tx]
                          })
                        },
                        {
                          translateY: particleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, ty]
                          })
                        },
                        {
                          scale: particleAnim.interpolate({
                            inputRange: [0, 0.45, 1],
                            outputRange: [0.3, 1.25, 0.5]
                          })
                        }
                      ]
                    }
                  ]}
                >
                  {bannerInfo.emojis[idx % bannerInfo.emojis.length]}
                </Animated.Text>
              );
            })}

            <Animated.View
              style={[
                styles.bannerBox,
                {
                  borderColor: bannerInfo.color,
                  opacity: bannerAnim,
                  transform: [
                    {
                      scale: bannerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.65, 1]
                      })
                    }
                  ]
                }
              ]}
            >
              <Text style={styles.bannerTitle}>{bannerInfo.title}</Text>
              {!!bannerInfo.sub && <Text style={styles.bannerSub}>{bannerInfo.sub}</Text>}
            </Animated.View>
          </View>
        )}

        {/* Flip 3D para Carta Virada às Cegas */}
        {blindFlip && (
          <View style={styles.fxOverlay} pointerEvents="none">
            <Animated.View
              style={[
                styles.blindToast,
                { borderColor: blindFlip.ok ? COLORS.good : COLORS.bad },
                {
                  transform: [
                    {
                      rotateY: flipAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['90deg', '0deg']
                      })
                    }
                  ]
                }
              ]}
            >
              {renderCardFace(blindFlip.id, { small: true })}
              <View>
                <Text style={styles.blindToastName}>{blindFlip.seatName} virou às cegas:</Text>
                <Text
                  style={{
                    color: blindFlip.ok ? COLORS.good : COLORS.bad,
                    fontWeight: '800',
                    fontSize: 14
                  }}
                >
                  {blindFlip.ok ? '✓ Serve! Vai para a mesa!' : '✗ Não serve! Leva o monte!'}
                </Text>
              </View>
            </Animated.View>
          </View>
        )}
      </View>

      {/* Mensagem de Estado + Log */}
      <View style={styles.msgPill}>
        <Text style={styles.msgTxt}>{statusMsg}</Text>
      </View>

      <View style={styles.logBox}>
        {s.log.slice(-2).map((line, i, arr) => (
          <Text
            key={i}
            style={[styles.logLine, i === arr.length - 1 && styles.logLineNew]}
            numberOfLines={1}
          >
            {line.replace(/<[^>]+>/g, '')}
          </Text>
        ))}
      </View>

      {/* Área do Jogador Atual (Tu) */}
      <View
        style={[
          styles.meArea,
          (myTurn || (s.phase === 'start' && s.starters.includes(v))) && {
            borderColor: PCOL[v % PCOL.length],
            backgroundColor: 'rgba(34, 211, 238, 0.06)'
          }
        ]}
      >
        <View style={styles.oppHead}>
          <View style={styles.oppIdentity}>
            <AvatarView
              avatar={players[v]?.avatar}
              color={players[v]?.color}
              xp={players[v]?.xp}
              size={28}
            />
            <Text style={[styles.meName, { color: PCOL[v % PCOL.length] }]}>
              {players[v]?.name || s.names[v]}
              {!hotseat ? ' (tu)' : ''}
            </Text>
          </View>
          <Text style={styles.oppStat}>✋ {s.hands[v].length} na mão</Text>
        </View>

        {renderSlots(v, true, myTurn && blindPhase && !s.pending && !s.turnPlays)}

        {/* Mão do Jogador */}
        <View style={styles.handWrap}>
          {hand.length > 0 ? (
            hand.map((cid) =>
              renderCardFace(cid, {
                selected: selected.includes(cid),
                pulse:
                  myTurn &&
                  s.canEnd &&
                  (rk(cid) === '3' || (s.turnRank != null && rk(cid) === s.turnRank)),
                onPress: () => toggleCard(cid)
              })
            )
          ) : (
            <Text style={styles.noneTxt}>sem cartas na mão</Text>
          )}
        </View>

        {/* Botões de Ação */}
        <View style={styles.actionsRow}>
          {s.phase === 'setup' && !s.ready[v] && (
            <TouchableOpacity
              style={[styles.neonBtn, selected.length !== 3 && styles.btnDisabled]}
              disabled={selected.length !== 3}
              onPress={() => {
                onDispatch({ type: 'setup', ids: [...selected] }, v);
                setSelected([]);
              }}
            >
              <Text style={styles.neonBtnTxt}>Confirmar ({selected.length}/3) ✓</Text>
            </TouchableOpacity>
          )}

          {s.phase === 'start' && s.starters.includes(v) && (
            <TouchableOpacity
              style={[styles.neonBtn, !playGroup && styles.btnDisabled]}
              disabled={!playGroup}
              onPress={() => {
                onDispatch({ type: 'play', ids: [...selected] }, v);
                setSelected([]);
              }}
            >
              <Text style={styles.neonBtnTxt}>
                Jogar {selected.length || ''} carta{selected.length > 1 ? 's' : ''} 🚀
              </Text>
            </TouchableOpacity>
          )}

          {myTurn && s.pending === 'dir' && (
            <>
              <TouchableOpacity
                style={styles.neonBtn}
                onPress={() => onDispatch({ type: 'dir', dir: 'up' }, v)}
              >
                <Text style={styles.neonBtnTxt}>↑ Acima de 7</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.neonBtn}
                onPress={() => onDispatch({ type: 'dir', dir: 'down' }, v)}
              >
                <Text style={styles.neonBtnTxt}>↓ Abaixo de 7</Text>
              </TouchableOpacity>
            </>
          )}

          {myTurn && !s.pending && (
            <>
              {!blindPhase && (
                <TouchableOpacity
                  style={[styles.neonBtn, !playGroup && styles.btnDisabled]}
                  disabled={!playGroup}
                  onPress={() => {
                    onDispatch({ type: 'play', ids: [...selected] }, v);
                    setSelected([]);
                  }}
                >
                  <Text style={styles.neonBtnTxt}>
                    Jogar {selected.length || ''} carta{selected.length > 1 ? 's' : ''} 🃏
                  </Text>
                </TouchableOpacity>
              )}

              {s.center.length > 0 && !s.turnPlays && (
                <TouchableOpacity
                  style={styles.ghostBtn}
                  onPress={() => onDispatch({ type: 'take' }, v)}
                >
                  <Text style={styles.ghostBtnTxt}>📥 Pegar {s.center.length} do meio</Text>
                </TouchableOpacity>
              )}

              {s.canEnd && (
                <TouchableOpacity
                  style={styles.ghostBtn}
                  onPress={() => onDispatch({ type: 'end' }, v)}
                >
                  <Text style={styles.ghostBtnTxt}>✓ Terminar jogada</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity style={styles.rulesMiniBtn} onPress={onOpenRules}>
            <Text style={styles.ghostBtnTxt}>📖 Regras</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  boardWrap: {
    width: '100%',
    gap: 10,
    paddingBottom: 20
  },
  oppsScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
    justifyContent: 'center'
  },
  oppCard: {
    minWidth: 144,
    maxWidth: 175,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    gap: 6,
    position: 'relative'
  },
  oppHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6
  },
  oppIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  oppName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1
  },
  oppStat: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600'
  },
  miniHandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 16
  },
  miniCardPip: {
    width: 10,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.45)'
  },
  miniMoreTxt: {
    fontSize: 10,
    color: COLORS.muted,
    marginLeft: 3
  },
  blockStamp: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1.5,
    borderColor: COLORS.bad,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 20
  },
  blockStampTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800'
  },
  tableArena: {
    width: '100%',
    borderRadius: 34,
    backgroundColor: '#0b1926',
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
    position: 'relative',
    overflow: 'hidden'
  },
  tableCleaning: {
    backgroundColor: '#132a3a'
  },
  tableInnerRim: {
    position: 'absolute',
    top: 7,
    bottom: 7,
    left: 7,
    right: 7,
    borderRadius: 27,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)'
  },
  rulePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(7, 8, 13, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)'
  },
  rulePillTxt: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center'
  },
  tableBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 4
  },
  pileCol: {
    alignItems: 'center',
    gap: 5
  },
  pileBox: {
    width: 44,
    height: 62,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stackLayer: {
    position: 'absolute',
    width: 38,
    height: 54,
    borderRadius: 7,
    backgroundColor: '#181534',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)'
  },
  emptyPileBox: {
    width: 38,
    height: 54,
    borderRadius: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyPileTxt: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 14
  },
  pileLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600'
  },
  centerZone: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 115,
    gap: 6,
    position: 'relative'
  },
  targetRing: {
    position: 'absolute',
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 1.5,
    backgroundColor: 'rgba(34, 211, 238, 0.06)'
  },
  shockwave: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3
  },
  centerCardsBox: {
    width: 68,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  centerStackedCard: {
    position: 'absolute'
  },
  flyingCardWrap: {
    position: 'absolute',
    zIndex: 30
  },
  emptyCenterBox: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    backgroundColor: 'rgba(7,8,13,0.4)'
  },
  emptyCenterTxt: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '600'
  },
  centerCountTxt: {
    fontSize: 11,
    color: COLORS.cyan,
    fontWeight: '700'
  },
  fxOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50
  },
  particleEmoji: {
    position: 'absolute',
    fontSize: 20
  },
  bannerBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    maxWidth: '90%'
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center'
  },
  bannerSub: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  blindToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderWidth: 2,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  blindToastName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600'
  },
  msgPill: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'center',
    maxWidth: '96%'
  },
  msgTxt: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center'
  },
  logBox: {
    alignItems: 'center',
    gap: 2,
    minHeight: 30
  },
  logLine: {
    color: COLORS.muted,
    fontSize: 11
  },
  logLineNew: {
    color: COLORS.text,
    fontWeight: '600'
  },
  meArea: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 12,
    gap: 10,
    alignItems: 'center'
  },
  meName: {
    fontSize: 14,
    fontWeight: '800'
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  slotBox: {
    width: 56,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  slotBoxSmall: {
    width: 38,
    height: 54
  },
  handWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    minHeight: 92
  },
  card: {
    width: 56,
    height: 80,
    borderRadius: 9,
    backgroundColor: '#fdfefe',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.18)',
    padding: 4,
    justifyContent: 'space-between',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4
  },
  cardSmall: {
    width: 38,
    height: 54,
    borderRadius: 7,
    padding: 3
  },
  cardJoker: {
    backgroundColor: '#fef3c7',
    borderColor: '#a855f7',
    borderWidth: 1.5
  },
  cardMirror: {
    borderColor: COLORS.violet,
    borderWidth: 2
  },
  cardPulse: {
    borderColor: COLORS.cyan,
    borderWidth: 2
  },
  cardSelected: {
    transform: [{ translateY: -12 }, { scale: 1.05 }],
    borderColor: COLORS.pink,
    borderWidth: 2.5
  },
  jokerInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  jokerTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: '#6b21a8',
    letterSpacing: 0.6
  },
  cardCornerTop: {
    alignItems: 'center',
    alignSelf: 'flex-start'
  },
  cardCornerBot: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    transform: [{ rotate: '180deg' }]
  },
  cardRank: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 13
  },
  cardSuitMini: {
    fontSize: 10,
    color: '#0f172a',
    lineHeight: 11
  },
  cardRedTxt: {
    color: '#dc2626'
  },
  cardGlyph: {
    position: 'absolute',
    top: 3,
    right: 4,
    fontSize: 11
  },
  cardBigSuit: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
    fontSize: 22,
    opacity: 0.2,
    color: '#0f172a'
  },
  cardBack: {
    backgroundColor: '#1e1b4b',
    borderColor: 'rgba(167, 139, 250, 0.5)',
    borderWidth: 1.5,
    padding: 3
  },
  cardBackPick: {
    borderColor: COLORS.cyan,
    borderWidth: 2
  },
  cardBackInner: {
    flex: 1,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.06)'
  },
  cardBackStar: {
    color: COLORS.cyan,
    fontSize: 13,
    opacity: 0.7
  },
  noneTxt: {
    color: COLORS.muted,
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 10
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  neonBtn: {
    backgroundColor: COLORS.cyan,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  neonBtnTxt: {
    color: '#04121a',
    fontWeight: '800',
    fontSize: 14
  },
  btnDisabled: {
    opacity: 0.4
  },
  ghostBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 13
  },
  ghostBtnTxt: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600'
  },
  rulesMiniBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11
  },
  coverBox: {
    backgroundColor: 'rgba(15, 18, 30, 0.95)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    marginVertical: 20
  },
  coverLock: { fontSize: 44 },
  coverTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center'
  },
  coverSub: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6
  }
});

