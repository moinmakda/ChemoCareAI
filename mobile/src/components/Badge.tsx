import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'small' | 'medium' | 'large';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'medium',
  style,
}) => {
  const getBackgroundColor = (): string => {
    switch (variant) {
      case 'primary':
        return colors.primary[100];
      case 'secondary':
        return colors.neutral[200];
      case 'success':
        return colors.successLight;
      case 'warning':
        return colors.warningLight;
      case 'error':
        return colors.errorLight;
      case 'info':
        return colors.infoLight;
      case 'neutral':
        return colors.neutral[200];
      default:
        return colors.primary[100];
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'primary':
        return colors.primary[700];
      case 'secondary':
        return colors.neutral[700];
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      case 'info':
        return colors.info;
      case 'neutral':
        return colors.neutral[700];
      default:
        return colors.primary[700];
    }
  };

  const getPadding = (): ViewStyle => {
    switch (size) {
      case 'small':
        return { paddingHorizontal: spacing.xs, paddingVertical: 2 };
      case 'medium':
        return { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs };
      case 'large':
        return { paddingHorizontal: spacing.md, paddingVertical: spacing.sm };
      default:
        return { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs };
    }
  };

  const getFontSize = (): number => {
    switch (size) {
      case 'small':
        return 10;
      case 'medium':
        return 12;
      case 'large':
        return 14;
      default:
        return 12;
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor() },
        getPadding(),
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: getTextColor(), fontSize: getFontSize() },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: typography.caption1.fontWeight as TextStyle['fontWeight'],
    textTransform: 'capitalize',
  },
});

export default Badge;
