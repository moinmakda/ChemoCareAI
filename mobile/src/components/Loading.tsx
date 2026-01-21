import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  ViewStyle,
  Animated,
  Easing,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
  overlay?: boolean;
  style?: ViewStyle;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'large',
  color,
  text,
  fullScreen = false,
  overlay = false,
  style,
}) => {
  const indicatorColor = color || colors.primary[500];

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, overlay && styles.overlay, style]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={size} color={indicatorColor} />
          {text && <Text style={styles.text}>{text}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={indicatorColor} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
};

// Skeleton loading placeholder
interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%' as `${number}%`,
  height = 16,
  borderRadius: radius = borderRadius.sm,
  style,
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: typeof width === 'number' ? width : width,
          height,
          borderRadius: radius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Card skeleton for loading card placeholders
export const CardSkeleton: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  return (
    <View style={[styles.cardSkeleton, style]}>
      <Skeleton width={60} height={60} borderRadius={borderRadius.md} />
      <View style={styles.cardSkeletonContent}>
        <Skeleton width="80%" height={16} />
        <Skeleton width="60%" height={12} style={{ marginTop: spacing.sm }} />
        <Skeleton width="40%" height={12} style={{ marginTop: spacing.xs }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 999,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral[0],
    borderRadius: 16,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: colors.neutral[200],
  },
  cardSkeleton: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  cardSkeletonContent: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
});

export default Loading;
