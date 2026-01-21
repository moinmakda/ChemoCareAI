/**
 * Button Component - Primary UI element for actions
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { colors, shadows, spacing, borderRadius, typography } from '../constants/theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  style,
  ...props
}) => {
  const getContainerStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.md,
      ...shadows.sm,
    };

    const sizeStyles: Record<string, ViewStyle> = {
      small: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, minHeight: 36 },
      medium: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 48 },
      large: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, minHeight: 56 },
    };

    const variantStyles: Record<string, ViewStyle> = {
      primary: { backgroundColor: colors.primary[500] },
      secondary: { backgroundColor: colors.neutral[200] },
      outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary[500] },
      ghost: { backgroundColor: 'transparent' },
      danger: { backgroundColor: colors.error },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(fullWidth && { width: '100%' }),
      ...(disabled && { opacity: 0.5 }),
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: '600',
      textAlign: 'center',
    };

    const sizeStyles: Record<string, TextStyle> = {
      small: { fontSize: typography.footnote.fontSize },
      medium: { fontSize: typography.body.fontSize },
      large: { fontSize: typography.headline.fontSize },
    };

    const variantStyles: Record<string, TextStyle> = {
      primary: { color: colors.neutral[0] },
      secondary: { color: colors.text.primary },
      outline: { color: colors.primary[500] },
      ghost: { color: colors.primary[500] },
      danger: { color: colors.neutral[0] },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  const iconColor = variant === 'outline' || variant === 'ghost' 
    ? colors.primary[500] 
    : variant === 'secondary' 
    ? colors.text.primary 
    : colors.neutral[0];

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style]}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={[getTextStyle(), icon ? { marginHorizontal: spacing.xs } : undefined]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;
