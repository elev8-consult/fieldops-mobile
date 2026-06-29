import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, font, radius, spacing } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'success';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}

const bg: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  danger: colors.danger,
  success: colors.success,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: Props) {
  const isSecondary = variant === 'secondary';
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg[variant],
          borderWidth: isSecondary ? 1.5 : 0,
          borderColor: colors.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {loading && (
          <ActivityIndicator
            color={isSecondary ? colors.primary : colors.white}
            style={{ marginRight: spacing.sm }}
          />
        )}
        <Text
          style={[
            styles.label,
            { color: isSecondary ? colors.primary : colors.white },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: font.tapTarget,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: font.body, fontWeight: '700' },
});
