import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

const STARS = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: ((i * 73) % 96) + 2,
  y: ((i * 47) % 94) + 3,
  size: (i % 3) + 2,
  color: [COLORS.cyan, COLORS.violet, COLORS.orange, COLORS.pink][i % 4]
}));

export const StarfieldBackground: React.FC = () => {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 2800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 2800, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.orb, styles.orbCyan]} />
      <View style={[styles.orb, styles.orbViolet]} />
      <View style={[styles.orb, styles.orbOrange]} />
      {STARS.map((s) => (
        <Animated.View
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: s.color,
            opacity: s.id % 2 === 0 ? pulse : 0.55
          }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    width: W * 0.85,
    height: W * 0.85,
    borderRadius: W * 0.45
  },
  orbCyan: {
    top: -W * 0.3,
    left: -W * 0.2,
    backgroundColor: 'rgba(34, 211, 238, 0.08)'
  },
  orbViolet: {
    top: H * 0.15,
    right: -W * 0.3,
    backgroundColor: 'rgba(167, 139, 250, 0.08)'
  },
  orbOrange: {
    bottom: -W * 0.25,
    left: W * 0.1,
    backgroundColor: 'rgba(251, 146, 60, 0.06)'
  }
});

