import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { auth as authApi } from '../../api/endpoints';
import { FadeInView } from '../../components/motion';
import {
  Banner,
  Button,
  Field,
  Input,
  PasswordInput,
  ProgressBar,
  Row,
  Screen,
  Text,
  TextButton,
} from '../../components/ui';
import { haptics } from '../../haptics';
import { useAction } from '../../hooks/useAsync';
import { useTheme } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';
import { AuthHeader } from './AuthHeader';

const CODE_LENGTH = 6;

/**
 * Six boxes for a six-digit code. One real input sits invisibly over them, so paste and
 * the keyboard's one-time-code suggestion still work; the boxes only show what it holds.
 * Each digit is felt as a light tick, and the sixth lands with a firmer click.
 */
function CodeInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange(next: string): void;
  error?: boolean;
}) {
  const t = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <Row gap={t.spacing.sm} style={{ justifyContent: 'space-between' }}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const digit = value[i] ?? '';
          const active = focused && (i === value.length || (i === CODE_LENGTH - 1 && value.length === CODE_LENGTH));
          return (
            <View
              key={i}
              style={{
                flex: 1,
                maxWidth: 52,
                aspectRatio: 0.86,
                borderRadius: t.radius.md,
                borderWidth: 2,
                borderColor: error
                  ? t.colors.danger
                  : active
                    ? t.colors.primary
                    : digit
                      ? t.colors.borderStrong
                      : 'transparent',
                backgroundColor: active ? t.colors.surface : t.colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[t.typography.numeric, { color: t.colors.text }]}>{digit}</Text>
            </View>
          );
        })}
      </Row>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(raw) => {
          const next = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
          if (next.length > value.length) {
            if (next.length === CODE_LENGTH) haptics.press();
            else haptics.selection();
          }
          onChange(next);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        accessibilityLabel="6-digit code"
        caretHidden
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent' }}
      />
    </Pressable>
  );
}

/**
 * Two-step reset in one screen: request a code, then set the new password.
 * Keeping it on one screen means the email the code was sent to is always visible.
 */
export function ForgotPasswordScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'ForgotPassword'>>();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const requestCode = useAction(async () => {
    const result = await authApi.forgotPassword(email.trim().toLowerCase());
    setNotice(result.message);
    setStep('reset');
    return result;
  });

  const resetPassword = useAction(async () => {
    await authApi.resetPassword(email.trim().toLowerCase(), otp.trim(), password);
    haptics.success();
    navigation.navigate('Login');
    return true;
  });

  return (
    <Screen scroll>
      <AuthHeader
        title={step === 'request' ? 'Reset your password' : 'Check your email'}
        subtitle={
          step === 'request'
            ? 'Enter your email and we will send you a 6-digit code.'
            : `Enter the code we sent to ${email.trim()}, then choose a new password.`
        }
        icon={step === 'request' ? 'key' : 'mail-open'}
      />

      <View style={{ marginBottom: t.spacing.xl }}>
        <ProgressBar value={step === 'request' ? 0.5 : 1} height={6} />
        <Text
          style={{ marginTop: 6, fontSize: 12.5, lineHeight: 17, fontWeight: '600', color: t.colors.textMuted }}
        >
          Step {step === 'request' ? 1 : 2} of 2
        </Text>
      </View>

      {notice ? <Banner tone="success" text={notice} /> : null}
      {requestCode.error ? <Banner tone="danger" text={requestCode.error} /> : null}
      {resetPassword.error ? <Banner tone="danger" text={resetPassword.error} /> : null}

      {step === 'request' ? (
        <FadeInView key="request">
          <Field label="Email" error={requestCode.fieldErrors?.email}>
            <Input
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="you@college.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={() => email.includes('@') && void requestCode.run()}
              error={Boolean(requestCode.fieldErrors?.email)}
            />
          </Field>
          <Button
            label="Send reset code"
            icon="paper-plane"
            onPress={() => void requestCode.run()}
            loading={requestCode.pending}
            disabled={!email.includes('@')}
          />
        </FadeInView>
      ) : (
        <FadeInView key="reset">
          <Field label="6-digit code" error={resetPassword.fieldErrors?.otp}>
            <CodeInput value={otp} onChange={setOtp} error={Boolean(resetPassword.fieldErrors?.otp)} />
          </Field>

          <Field
            label="New password"
            error={resetPassword.fieldErrors?.password}
            hint="At least 8 characters, with a letter and a number."
          >
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              placeholder="Choose a new password"
              autoComplete="new-password"
              textContentType="newPassword"
              error={Boolean(resetPassword.fieldErrors?.password)}
            />
          </Field>

          <Button
            label="Set new password"
            onPress={() => void resetPassword.run()}
            loading={resetPassword.pending}
            disabled={otp.length !== CODE_LENGTH || password.length < 8}
          />

          <Row style={{ justifyContent: 'center', marginTop: t.spacing.lg }}>
            <TextButton
              label="Send another code"
              onPress={() => {
                setNotice(null);
                setOtp('');
                setStep('request');
              }}
            />
          </Row>
        </FadeInView>
      )}

      <Row style={{ justifyContent: 'center', marginTop: t.spacing.md }}>
        <TextButton label="Back to sign in" tone="muted" onPress={() => navigation.navigate('Login')} />
      </Row>
    </Screen>
  );
}
