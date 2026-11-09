import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { frameFor, hslColor } from '../theme';

interface AvatarProps {
  avatar?: string;
  color?: number;
  xp?: number;
  size?: number;
}

export const AvatarView: React.FC<AvatarProps> = ({
  avatar = '🎮',
  color = 190,
  xp = 0,
  size = 44
}) => {
  const frame = frameFor(xp);
  const bg = hslColor(color, 72, 34);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderColor: frame.borderColor,
          borderWidth: frame.cls === 'f0' ? 1.5 : 2.5,
          shadowColor: frame.glowColor === 'transparent' ? '#000' : frame.borderColor
        }
      ]}
    >
      <Text style={{ fontSize: Math.round(size * 0.52) }}>{avatar || '🎮'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 4
  }
});

