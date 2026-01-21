import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '@/constants/theme';
import { Avatar } from './Avatar';

interface ListItemProps {
  title: string;
  subtitle?: string;
  description?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  leftAvatar?: { source?: { uri: string }; name?: string };
  rightText?: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'card';
  style?: ViewStyle;
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  description,
  leftIcon,
  leftAvatar,
  rightText,
  rightIcon,
  rightElement,
  showChevron = false,
  onPress,
  disabled = false,
  variant = 'default',
  style,
}) => {
  const Container = onPress ? TouchableOpacity : View;

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: variant === 'card' ? spacing.md : 0,
    backgroundColor: variant === 'card' ? colors.neutral[0] : 'transparent',
    borderRadius: variant === 'card' ? borderRadius.lg : 0,
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <Container
      style={[containerStyle, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {/* Left Section */}
      {leftIcon && (
        <View style={styles.leftIconContainer}>
          <Ionicons name={leftIcon} size={24} color={colors.primary[500]} />
        </View>
      )}

      {leftAvatar && (
        <Avatar
          source={leftAvatar.source}
          name={leftAvatar.name}
          size="medium"
          style={styles.leftAvatar}
        />
      )}

      {/* Content Section */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}
      </View>

      {/* Right Section */}
      {rightText && <Text style={styles.rightText}>{rightText}</Text>}

      {rightIcon && (
        <Ionicons
          name={rightIcon}
          size={20}
          color={colors.text.secondary}
          style={styles.rightIcon}
        />
      )}

      {rightElement}

      {showChevron && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.text.tertiary}
          style={styles.chevron}
        />
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  leftIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  leftAvatar: {
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.callout.fontSize,
    color: colors.text.secondary,
    marginTop: 2,
  },
  description: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  rightText: {
    fontSize: typography.callout.fontSize,
    fontWeight: '500',
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  rightIcon: {
    marginLeft: spacing.sm,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
});

export default ListItem;
