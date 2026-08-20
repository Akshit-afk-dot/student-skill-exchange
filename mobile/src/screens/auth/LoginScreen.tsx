import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { Banner, Body, Button, Caption, Field, Input, Row, Screen, Title } from '../../components/ui';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useAction } from '../../hooks/useAsync';
import { useAuth } from '../../store/auth';
import { useTheme } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

export function LoginScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn } = useAuth();
  const google = useGoogleSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const submit = useAction(async () => signIn(email.trim().toLowerCase(), password));

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingTop: t.spacing.xxl, marginBottom: t.spacing.xl }}>
          <Title>Welcome back</Title>
          <Body muted style={{ marginTop: t.spacing.xs }}>
            Sign in to pick up where you left off.
          </Body>
        </View>

        {submit.error ? <Banner tone="danger" text={submit.error} /> : null}
        {google.error ? <Banner tone="danger" text={google.error} /> : null}

        <Field label="Email" error={submit.fieldErrors?.email}>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@college.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            error={Boolean(submit.fieldErrors?.email)}
          />
        </Field>

        <Field label="Password" error={submit.fieldErrors?.password}>
          <View>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={() => canSubmit && void submit.run()}
              returnKeyType="go"
              error={Boolean(submit.fieldErrors?.password)}
              style={{ paddingRight: 64 }}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}
              hitSlop={8}
            >
              <Text style={{ color: t.colors.primary, fontSize: 13, fontWeight: '600' }}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>
        </Field>

        <Pressable
          onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
          style={{ alignSelf: 'flex-end', marginBottom: t.spacing.lg }}
          hitSlop={8}
        >
          <Text style={{ color: t.colors.primary, fontSize: 14, fontWeight: '600' }}>
            Forgot password?
          </Text>
        </Pressable>

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
              variant="ghost"
              icon="logo-google"
              onPress={google.signIn}
              loading={google.pending}
            />
          </>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: t.spacing.xl,
            gap: 4,
          }}
        >
          <Body muted>New here?</Body>
          <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
            <Text style={{ color: t.colors.primary, fontSize: 15, fontWeight: '600' }}>
              Create an account
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
