import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { apiErrorMessage } from '@/lib/api';
import { requestOtp, verifyOtp } from '@/lib/auth';
import { useAuthStore } from '@/store/auth.store';
import { colors, font, radius, spacing } from '@/theme';

export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const signIn = useAuthStore((s) => s.signIn);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verify = useMutation({
    mutationFn: () => verifyOtp(phone, code.trim()),
    onSuccess: async (res) => {
      await signIn(res.access_token, res.user);
      router.replace('/(app)/home');
    },
    onError: (e) => setError(apiErrorMessage(e, 'That code was not correct.')),
  });

  const resend = useMutation({
    mutationFn: () => requestOtp(phone),
    onSuccess: () => setError(null),
    onError: (e) => setError(apiErrorMessage(e, 'Could not resend the code.')),
  });

  const valid = code.trim().length >= 4;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.flex}>
          <View style={styles.header}>
            <Text style={styles.title}>Enter code</Text>
            <Text style={styles.subtitle}>
              We sent a code to {phone}. Type it below.
            </Text>
          </View>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => {
              setCode(t.replace(/\D/g, ''));
              setError(null);
            }}
            placeholder="••••••"
            placeholderTextColor={colors.border}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            textContentType="oneTimeCode"
            onSubmitEditing={() => valid && verify.mutate()}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={() => resend.mutate()}
            disabled={resend.isPending}
            style={styles.resend}
          >
            <Text style={styles.resendText}>
              {resend.isPending ? 'Sending…' : "Didn't get it? Resend code"}
            </Text>
          </Pressable>

          <View style={styles.spacer} />

          <Button
            label="Verify & continue"
            onPress={() => verify.mutate()}
            disabled={!valid}
            loading={verify.isPending}
          />
          <View style={{ height: spacing.md }} />
          <Button
            label="Change number"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginTop: spacing.xl, marginBottom: spacing.xl },
  title: { fontSize: font.h1, fontWeight: '800', color: colors.text },
  subtitle: {
    fontSize: font.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  codeInput: {
    minHeight: 72,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    textAlign: 'center',
    fontSize: 40,
    letterSpacing: 12,
    fontWeight: '800',
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: font.label, marginTop: spacing.md },
  resend: { marginTop: spacing.lg },
  resendText: {
    color: colors.primary,
    fontSize: font.label,
    fontWeight: '600',
  },
  spacer: { flex: 1 },
});
