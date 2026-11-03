import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { Banner, Body, Button, Caption, Field, Input, Row, Screen, Title } from '../../components/ui';
import { useAction } from '../../hooks/useAsync';
import { useAuth } from '../../store/auth';
import { useTheme } from '../../theme';
import { LEGAL_URLS, openPage } from '../../utils/legal';
import type { AuthStackParamList } from '../../navigation/types';

const YEARS = [1, 2, 3, 4, 5];

export function RegisterScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [accepted, setAccepted] = useState(false);

  const submit = useAction(async () =>
    register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      ...(college.trim() ? { college: college.trim() } : {}),
      ...(department.trim() ? { department: department.trim() } : {}),
      ...(year ? { year } : {}),
      acceptTerms: true,
    }),
  );

  const canSubmit =
    name.trim().length >= 2 && email.includes('@') && password.length >= 8 && accepted;

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingTop: t.spacing.lg, marginBottom: t.spacing.xl }}>
          <Title>Create your account</Title>
          <Body muted style={{ marginTop: t.spacing.xs }}>
            Your college details help us match you with students nearby.
          </Body>
        </View>

        {submit.error ? <Banner tone="danger" text={submit.error} /> : null}

        <Field label="Full name" error={submit.fieldErrors?.name}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Rahul Sharma"
            autoCapitalize="words"
            autoComplete="name"
            error={Boolean(submit.fieldErrors?.name)}
          />
        </Field>

        <Field label="College email" error={submit.fieldErrors?.email}>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@college.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={Boolean(submit.fieldErrors?.email)}
          />
        </Field>

        <Field
          label="Password"
          error={submit.fieldErrors?.password}
          hint="At least 8 characters, with a letter and a number."
        >
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Choose a password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            error={Boolean(submit.fieldErrors?.password)}
          />
        </Field>

        <Field label="College (optional)">
          <Input
            value={college}
            onChangeText={setCollege}
            placeholder="PES University"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Department (optional)">
          <Input
            value={department}
            onChangeText={setDepartment}
            placeholder="Computer Science"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Year of study (optional)">
          <Row gap={t.spacing.sm}>
            {YEARS.map((y) => {
              const active = year === y;
              return (
                <Pressable
                  key={y}
                  onPress={() => setYear(active ? null : y)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    borderRadius: t.radius.md,
                    alignItems: 'center',
                    backgroundColor: active ? t.colors.primary : t.colors.surface,
                    borderWidth: 1,
                    borderColor: active ? t.colors.primary : t.colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? t.colors.textInverse : t.colors.text,
                      fontWeight: '600',
                    }}
                  >
                    {y}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
        </Field>

        <Row gap={t.spacing.md} style={{ alignItems: 'flex-start', marginBottom: t.spacing.lg }}>
          <Pressable
            onPress={() => setAccepted((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            accessibilityLabel="I am 18 or older and agree to the terms of use and privacy policy"
            hitSlop={10}
          >
            <Ionicons
              name={accepted ? 'checkbox' : 'square-outline'}
              size={24}
              color={accepted ? t.colors.primary : t.colors.textMuted}
            />
          </Pressable>
          <Text style={{ flex: 1, color: t.colors.text, fontSize: 14, lineHeight: 20 }}>
            I am 18 or older and agree to the{' '}
            <Text
              onPress={() => openPage(LEGAL_URLS.terms)}
              accessibilityRole="link"
              style={{ color: t.colors.primary, fontWeight: '600' }}
            >
              Terms of use
            </Text>{' '}
            and{' '}
            <Text
              onPress={() => openPage(LEGAL_URLS.privacy)}
              accessibilityRole="link"
              style={{ color: t.colors.primary, fontWeight: '600' }}
            >
              Privacy policy
            </Text>
            . There is no tolerance for abusive behaviour or objectionable content.
          </Text>
        </Row>

        <Button
          label="Create account"
          onPress={() => void submit.run()}
          loading={submit.pending}
          disabled={!canSubmit}
        />

        <Caption style={{ textAlign: 'center', marginTop: t.spacing.md }}>
          We will email you a link to confirm your address.
        </Caption>

        <View
          style={{ flexDirection: 'row', justifyContent: 'center', marginTop: t.spacing.xl, gap: 4 }}
        >
          <Body muted>Already registered?</Body>
          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
            <Text style={{ color: t.colors.primary, fontSize: 15, fontWeight: '600' }}>Sign in</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
