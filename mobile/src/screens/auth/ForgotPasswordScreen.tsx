import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Body, Button, Field, Input, Screen, Title } from '../../components/ui';
import { useAction } from '../../hooks/useAsync';
import { auth as authApi } from '../../api/endpoints';
import { useTheme } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

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
    navigation.navigate('Login');
    return true;
  });

  return (
    <Screen scroll>
      <View style={{ paddingTop: t.spacing.xxl, marginBottom: t.spacing.xl }}>
        <Title>Reset your password</Title>
        <Body muted style={{ marginTop: t.spacing.xs }}>
          {step === 'request'
            ? 'Enter your email and we will send you a 6-digit code.'
            : `Enter the code sent to ${email} and choose a new password.`}
        </Body>
      </View>

      {notice ? <Banner tone="success" text={notice} /> : null}
      {requestCode.error ? <Banner tone="danger" text={requestCode.error} /> : null}
      {resetPassword.error ? <Banner tone="danger" text={resetPassword.error} /> : null}

      {step === 'request' ? (
        <>
          <Field label="Email" error={requestCode.fieldErrors?.email}>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@college.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={Boolean(requestCode.fieldErrors?.email)}
            />
          </Field>
          <Button
            label="Send reset code"
            onPress={() => void requestCode.run()}
            loading={requestCode.pending}
            disabled={!email.includes('@')}
          />
        </>
      ) : (
        <>
          <Field label="6-digit code" error={resetPassword.fieldErrors?.otp}>
            <Input
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              error={Boolean(resetPassword.fieldErrors?.otp)}
              style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }}
            />
          </Field>

          <Field
            label="New password"
            error={resetPassword.fieldErrors?.password}
            hint="At least 8 characters, with a letter and a number."
          >
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="Choose a new password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              error={Boolean(resetPassword.fieldErrors?.password)}
            />
          </Field>

          <Button
            label="Set new password"
            onPress={() => void resetPassword.run()}
            loading={resetPassword.pending}
            disabled={otp.length !== 6 || password.length < 8}
          />

          <Button
            label="Send another code"
            variant="ghost"
            onPress={() => {
              setNotice(null);
              setStep('request');
            }}
            style={{ marginTop: t.spacing.md }}
          />
        </>
      )}

      <Button
        label="Back to sign in"
        variant="ghost"
        onPress={() => navigation.navigate('Login')}
        style={{ marginTop: t.spacing.lg }}
      />
    </Screen>
  );
}
