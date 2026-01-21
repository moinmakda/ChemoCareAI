/**
 * Input Component - Text input with label and validation
 */
import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  required?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerStyle,
      required,
      secureTextEntry,
      style,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const getBorderColor = (): string => {
      if (error) return colors.error;
      if (isFocused) return colors.primary[500];
      return colors.border.light;
    };

    const inputContainerStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: getBorderColor(),
      borderRadius: borderRadius.md,
      backgroundColor: colors.neutral[0],
      paddingHorizontal: spacing.md,
      minHeight: 52,
    };

    const inputStyle: TextStyle = {
      flex: 1,
      fontSize: typography.body.fontSize,
      color: colors.text.primary,
      paddingVertical: spacing.md,
      minHeight: 44,
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <View style={styles.labelContainer}>
            <Text style={styles.label}>{label}</Text>
            {required && <Text style={styles.required}>*</Text>}
          </View>
        )}

        <View style={inputContainerStyle}>
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={20}
              color={isFocused ? colors.primary[500] : colors.text.secondary}
              style={styles.leftIcon}
            />
          )}

          <TextInput
            ref={ref}
            style={[inputStyle, style]}
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry={secureTextEntry && !isPasswordVisible}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            value={props.value}
            onChangeText={props.onChangeText}
            placeholder={props.placeholder}
            keyboardType={props.keyboardType}
            autoCapitalize={props.autoCapitalize}
            autoCorrect={props.autoCorrect}
            returnKeyType={props.returnKeyType}
            autoComplete={props.autoComplete}
            maxLength={props.maxLength}
          />

          {secureTextEntry && (
            <TouchableOpacity
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.text.secondary}
              />
            </TouchableOpacity>
          )}

          {rightIcon && !secureTextEntry && (
            <TouchableOpacity
              onPress={onRightIconPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={rightIcon} size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  labelContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.subhead.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
  },
  required: {
    fontSize: typography.subhead.fontSize,
    fontWeight: '500',
    color: colors.error,
    marginLeft: 2,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  errorText: {
    fontSize: typography.caption1.fontSize,
    color: colors.error,
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});

Input.displayName = 'Input';

export default Input;
