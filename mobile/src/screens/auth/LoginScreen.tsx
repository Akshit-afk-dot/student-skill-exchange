import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Banner,
  Body,
  Button,
  Caption,
  Field,
  Input,
  PasswordInput,
  Row,
  Screen,
  TextButton,
} from '../../components/ui';
import { haptics } from '../../haptics';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useAction } from '../../hooks/useAsync';
import { useAuth } from '../../store/auth';
import { useTheme } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';
import { AuthHeader } from './AuthHeader';

export function LoginScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn } = useAuth();
  const google = useGoogleSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = useAction(async () => {
    await signIn(email.trim().toLowerCase(), password);
    // The door opening: felt as the app swaps to the signed-in tabs.
    haptics.success();
  });

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <Screen scroll>
      {/* Screen keeps the focused field clear of the keyboard. */}
      <View>
        <AuthHeader title="Welcome back" subtitle="Sign in to pick up where you left off." />

        {submit.error ? <Banner tone="danger" text={submit.error} /> : null}
        {google.error ? <Banner tone="danger" text={google.error} /> : null}

        <Field label="Email" error={submit.fieldErrors?.email}>
          <Input
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="you@college.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            error={Boolean(submit.fieldErrors?.email)}
          />
        </Field>

        <Field label="Password" error={submit.fieldErrors?.password}>
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={() => canSubmit && void submit.run()}
            returnKeyType="go"
            error={Boolean(submit.fieldErrors?.password)}
          />
        </Field>

        <TextButton
          label="Forgot password?"
          size={14}
          onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
          style={{ alignSelf: 'flex-end', marginTop: -t.spacing.sm, marginBottom: t.spacing.lg }}
        />

        <Button
          label="Sign in"
          onPress={() => void submit.run()}
          loading={submit.pending}
          disabled={!canSubmit}
        />

        {google.available ? (
          <>
            <Row style={{ marginVertical: t.spacing.lg }}>
              <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
              <Caption style={{ marginHorizontal: t.spacing.md }}>or</Caption>
              <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
            </Row>
            <Button
              label="Continue with Google"
              variant="secondary"
              icon="logo-google"
              onPress={google.signIn}
              loading={google.pending}
            />
          </>
        ) : null}

        <Row gap={4} style={{ justifyContent: 'center', marginTop: t.spacing.xl }}>
          <Body muted>New here?</Body>
          <TextButton label="Create an account" onPress={() => navigation.navigate('Register')} />
        </Row>
      </View>
    </Screen>
  );
}
