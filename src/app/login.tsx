import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { apiErrorMessage } from '@/lib/api';
import { requestOtp } from '@/lib/auth';
import { colors, font, radius, spacing } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => requestOtp(phone.trim()),
    onSuccess: () => {
      router.push({ pathname: '/verify', params: { phone: phone.trim() } });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not send the code.')),
  });

  const valid = phone.trim().replace(/\D/g, '').length >= 7;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.flex}>
          <View style={styles.header}>
            <Text style={styles.logo}>FieldOps</Text>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>
              Enter your phone number. We&apos;ll send you a code.
            </Text>
          </View>

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              setError(null);
            }}
            placeholder="e.g. 03 123 456"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => valid && mutation.mutate()}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.spacer} />

          <Button
            label="Send code"
            onPress={() => mutation.mutate()}
            disabled={!valid}
            loading={mutation.isPending}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginTop: spacing.xl, marginBottom: spacing.xl },
  logo: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.lg,
  },
  title: { fontSize: font.h1, fontWeight: '800', color: colors.text },
  subtitle: {
    fontSize: font.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  label: {
    fontSize: font.label,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: font.tapTarget,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: font.h2,
    color: colors.text,
  },
  error: {
    color: colors.danger,
    fontSize: font.label,
    marginTop: spacing.md,
  },
  spacer: { flex: 1 },
});
