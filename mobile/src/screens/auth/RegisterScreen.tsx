import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import {
  Banner,
  Body,
  Button,
  Caption,
  Checkbox,
  Chip,
  Field,
  Input,
  Overline,
  PasswordInput,
  Row,
  Screen,
  Text,
  TextButton,
} from '../../components/ui';
import { haptics } from '../../haptics';
import { useAction } from '../../hooks/useAsync';
import { useAuth } from '../../store/auth';
import { useTheme } from '../../theme';
import { LEGAL_URLS, openPage } from '../../utils/legal';
import type { AuthStackParamList } from '../../navigation/types';
import { AuthHeader } from './AuthHeader';

const YEARS = [1, 2, 3, 4, 5] as const;
const YEAR_LABEL: Record<(typeof YEARS)[number], string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
  4: '4th',
  5: '5th',
};

/** The server's rules (auth/validators.ts), shown up front rather than after a failed submit. */
const RULES: ReadonlyArray<{ label: string; test(v: string): boolean }> = [
  { label: '8+ characters', test: (v) => v.length >= 8 },
  { label: 'A letter', test: (v) => /[a-zA-Z]/.test(v) },
  { label: 'A number', test: (v) => /[0-9]/.test(v) },
];

/** One requirement. Ticks over, with a pop and a light tick haptic, the moment it is met. */
function Rule({ label, met }: { label: string; met: boolean }) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!met) return;
    haptics.selection();
    scale.value = withSequence(
      withSpring(1.25, t.motion.springs.spatialFast),
      withSpring(1, t.motion.springs.bouncy),
    );
  }, [met, scale, t.motion.springs]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Row gap={5} style={{ minHeight: 22 }}>
      <Animated.View style={iconStyle}>
        <Ionicons
          name={met ? 'checkmark-circle' : 'ellipse-outline'}
          size={16}
          color={met ? t.colors.success : t.colors.textMuted}
        />
      </Animated.View>
      <Text
        style={{
          fontSize: 13,
          lineHeight: 17,
          fontWeight: met ? '600' : '500',
          color: met ? t.colors.success : t.colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Row>
  );
}

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

  const submit = useAction(async () => {
    await register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      ...(college.trim() ? { college: college.trim() } : {}),
      ...(department.trim() ? { department: department.trim() } : {}),
      ...(year ? { year } : {}),
      acceptTerms: true,
    });
    haptics.achievement();
  });

  const passwordOk = RULES.every((rule) => rule.test(password));
  const canSubmit = name.trim().length >= 2 && email.includes('@') && passwordOk && accepted;

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AuthHeader
          title="Create your account"
          subtitle="It takes a minute. Your college details help us find students near you."
          icon="person-add"
        />

        {submit.error ? <Banner tone="danger" text={submit.error} /> : null}

        <Overline style={{ marginBottom: t.spacing.md }}>You</Overline>

        <Field label="Full name" error={submit.fieldErrors?.name}>
          <Input
            icon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder="Rahul Sharma"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            error={Boolean(submit.fieldErrors?.name)}
          />
        </Field>

        <Field label="College email" error={submit.fieldErrors?.email}>
          <Input
            icon="mail-outline"
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

        <View style={{ marginBottom: t.spacing.lg }}>
          <Field label="Password" error={submit.fieldErrors?.password}>
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              placeholder="Choose a password"
              autoComplete="new-password"
              textContentType="newPassword"
              error={Boolean(submit.fieldErrors?.password)}
            />
          </Field>
          <Row gap={t.spacing.lg} style={{ marginTop: -t.spacing.sm, flexWrap: 'wrap' }}>
            {RULES.map((rule) => (
              <Rule key={rule.label} label={rule.label} met={rule.test(password)} />
            ))}
          </Row>
        </View>

        <Overline style={{ marginTop: t.spacing.sm, marginBottom: t.spacing.md }}>
          Your college · optional
        </Overline>

        <Field label="College">
          <Input
            icon="school-outline"
            value={college}
            onChangeText={setCollege}
            placeholder="PES University"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Department">
          <Input
            icon="library-outline"
            value={department}
            onChangeText={setDepartment}
            placeholder="Computer Science"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Year of study">
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
            {YEARS.map((y) => (
              <Chip
                key={y}
                label={YEAR_LABEL[y]}
                selected={year === y}
                onPress={() => setYear(year === y ? null : y)}
              />
            ))}
          </Row>
        </Field>

        <View style={{ marginTop: t.spacing.xs, marginBottom: t.spacing.xl }}>
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            accessibilityLabel="I am 18 or older and agree to the terms of use and privacy policy"
          >
            <Text style={{ color: t.colors.text, fontSize: 14, lineHeight: 21 }}>
              I am 18 or older and agree to the{' '}
              <Text
                onPress={() => openPage(LEGAL_URLS.terms)}
                accessibilityRole="link"
                style={{ color: t.colors.primary, fontWeight: '700' }}
              >
                Terms of use
              </Text>{' '}
              and{' '}
              <Text
                onPress={() => openPage(LEGAL_URLS.privacy)}
                accessibilityRole="link"
                style={{ color: t.colors.primary, fontWeight: '700' }}
              >
                Privacy policy
              </Text>
              . There is no tolerance for abusive behaviour or objectionable content.
            </Text>
          </Checkbox>
        </View>

        <Button
          label="Create account"
          onPress={() => void submit.run()}
          loading={submit.pending}
          disabled={!canSubmit}
        />

        <Caption style={{ textAlign: 'center', marginTop: t.spacing.md }}>
          We will email you a link to confirm your address.
        </Caption>

        <Row gap={4} style={{ justifyContent: 'center', marginTop: t.spacing.xl }}>
          <Body muted>Already registered?</Body>
          <TextButton label="Sign in" onPress={() => navigation.navigate('Login')} />
        </Row>
      </KeyboardAvoidingView>
    </Screen>
  );
}
