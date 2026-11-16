import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { BASE_URL } from '../api/client';
import { auth as authApi } from '../api/endpoints';
import { FadeInView } from '../components/motion';
import {
  Avatar,
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Field,
  IconTile,
  ListRow,
  Overline,
  PasswordInput,
  Row,
  Screen,
  Segmented,
  Text,
} from '../components/ui';
import {
  haptics,
  hapticsSupported,
  setHapticEngine,
  setHapticLevel,
  useHapticSettings,
  type AndroidEngine,
  type HapticLevel,
} from '../haptics';
import { useAction } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { LEGAL_URLS, contactSupport, openPage } from '../utils/legal';
import type { RootStackParamList } from '../navigation/types';

const LEVEL_NOTE: Record<HapticLevel, string> = {
  off: 'No vibration at all.',
  subtle: 'Only the moments that matter: successes, errors, new messages and connections.',
  full: 'Everything, including the light ticks that follow motion, like a score filling up.',
};

const ENGINE_NOTE: Record<AndroidEngine, string> = {
  system: 'Uses your phone’s own haptic effects. Short and precise on most phones.',
  vibration: 'Drives the vibration motor directly. Try this if Crisp feels weak or does nothing.',
};

/** Patterns you can try from Settings, so the choice above is made by feel, not by guess. */
const SAMPLES: ReadonlyArray<{ label: string; icon: keyof typeof Ionicons.glyphMap; play(): void }> = [
  { label: 'Tap', icon: 'finger-print', play: () => haptics.press() },
  { label: 'Success', icon: 'checkmark-circle', play: () => haptics.success() },
  { label: 'Match score', icon: 'speedometer', play: () => void haptics.scoreReveal(86, 900, true) },
  { label: 'Connection', icon: 'swap-horizontal', play: () => void haptics.connection() },
  { label: 'Five stars', icon: 'star', play: () => haptics.starRating(5) },
  { label: 'Error', icon: 'close-circle', play: () => haptics.error() },
];

/** A titled group of rows, iOS-settings style: a quiet label over one card. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: t.spacing.xl }}>
      <Overline style={{ marginBottom: t.spacing.sm, marginLeft: 4 }}>{title}</Overline>
      <Card style={{ padding: 0, overflow: 'hidden' }}>{children}</Card>
    </View>
  );
}

function HapticsCard() {
  const t = useTheme();
  const { level, engine } = useHapticSettings();

  return (
    <View style={{ marginBottom: t.spacing.xl }}>
      <Overline style={{ marginBottom: t.spacing.sm, marginLeft: 4 }}>Haptics</Overline>
      <Card>
        <Row gap={t.spacing.md} style={{ marginBottom: t.spacing.md }}>
          <IconTile icon="pulse" tone="primary" size={38} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: '600', color: t.colors.text }}>Vibration</Text>
            <Caption>How much the app talks back through your hand</Caption>
          </View>
        </Row>

        <Segmented<HapticLevel>
          value={level}
          onChange={(next) => {
            setHapticLevel(next);
            // Play a sample at the new level, so the difference is felt straight away.
            if (next === 'full') haptics.achievement();
            else if (next === 'subtle') haptics.success();
          }}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'subtle', label: 'Subtle' },
            { value: 'full', label: 'Full' },
          ]}
        />
        <Caption style={{ marginTop: t.spacing.sm, fontSize: 13, lineHeight: 18 }}>{LEVEL_NOTE[level]}</Caption>

        {Platform.OS === 'android' && level !== 'off' ? (
          <FadeInView>
            <Divider spacing={t.spacing.lg} />
            <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: '600', color: t.colors.text, marginBottom: 8 }}>
              Vibration style
            </Text>
            <Segmented<AndroidEngine>
              value={engine}
              onChange={(next) => {
                setHapticEngine(next);
                haptics.success();
              }}
              options={[
                { value: 'system', label: 'Crisp' },
                { value: 'vibration', label: 'Strong' },
              ]}
            />
            <Caption style={{ marginTop: t.spacing.sm, fontSize: 13, lineHeight: 18 }}>{ENGINE_NOTE[engine]}</Caption>
          </FadeInView>
        ) : null}

        {level !== 'off' ? (
          <>
            <Divider spacing={t.spacing.lg} />
            <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: '600', color: t.colors.text, marginBottom: 8 }}>
              Feel it
            </Text>
            <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
              {SAMPLES.map((sample) => (
                <Button
                  key={sample.label}
                  label={sample.label}
                  icon={sample.icon}
                  variant="tonal"
                  size="sm"
                  fullWidth={false}
                  // The sample is the feedback; a tap haptic on top would muddy it.
                  haptic={null}
                  onPress={sample.play}
                />
              ))}
            </Row>
            {!hapticsSupported ? (
              <Caption style={{ marginTop: t.spacing.sm }}>Haptics play on a phone, not in a browser.</Caption>
            ) : null}
          </>
        ) : null}
      </Card>
    </View>
  );
}

export function SettingsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const changePassword = useAction(async () => {
    await authApi.changePassword(currentPassword, newPassword);
    setNotice('Password changed. You have been signed out of your other devices.');
    setChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    return true;
  });

  const resendVerification = useAction(async () => {
    await authApi.resendVerification();
    setNotice('Verification email sent. Check your inbox, and your spam folder if it is not there.');
    return true;
  });

  function confirmSignOut() {
    haptics.warn();
    Alert.alert('Sign out?', 'You will need your password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen scroll edges={[]}>
      {notice ? <Banner tone="success" text={notice} /> : null}
      {changePassword.error ? <Banner tone="danger" text={changePassword.error} /> : null}
      {resendVerification.error ? <Banner tone="danger" text={resendVerification.error} /> : null}

      {/* Who you are signed in as, then everything about that account. */}
      <Card style={{ marginBottom: t.spacing.xl }}>
        <Row gap={t.spacing.md}>
          <Avatar name={user?.name ?? '?'} uri={user?.profileImage} size={56} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[t.typography.heading, { color: t.colors.text }]}>
              {user?.name}
            </Text>
            <Row gap={5}>
              <Caption numberOfLines={1} style={{ flexShrink: 1 }}>
                {user?.email}
              </Caption>
              {user?.emailVerified ? (
                <Ionicons name="checkmark-circle" size={14} color={t.colors.success} accessibilityLabel="Email verified" />
              ) : null}
            </Row>
          </View>
        </Row>
        {!user?.emailVerified ? (
          <View style={{ marginTop: t.spacing.md }}>
            <Banner
              tone="warning"
              text="Your email is not verified yet. Verify it to send requests and messages."
            />
            <Button
              label="Resend verification email"
              variant="secondary"
              size="md"
              icon="mail"
              onPress={() => void resendVerification.run()}
              loading={resendVerification.pending}
            />
          </View>
        ) : null}
      </Card>

      <Group title="Account">
        <ListRow icon="person" title="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
        <Divider spacing={0} />
        <ListRow
          icon="layers"
          tone="teach"
          title="My skills"
          subtitle="What you teach and want to learn"
          onPress={() => navigation.navigate('MySkills')}
        />
      </Group>

      <HapticsCard />

      <View style={{ marginBottom: t.spacing.xl }}>
        <Overline style={{ marginBottom: t.spacing.sm, marginLeft: 4 }}>Security</Overline>
        <Card style={{ padding: changingPassword ? t.spacing.lg : 0, overflow: 'hidden' }}>
          {!user?.hasPassword ? (
            <View style={{ padding: t.spacing.lg }}>
              <Body small muted>
                You sign in with Google, so there is no password to change. Use “Forgot password” on the
                sign-in screen if you want to set one.
              </Body>
            </View>
          ) : !changingPassword ? (
            <ListRow icon="key" tone="accent" title="Change password" onPress={() => setChangingPassword(true)} />
          ) : (
            <FadeInView>
              <Field label="Current password" error={changePassword.fieldErrors?.currentPassword}>
                <PasswordInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoComplete="current-password"
                />
              </Field>
              <Field
                label="New password"
                error={changePassword.fieldErrors?.newPassword}
                hint="At least 8 characters, with a letter and a number."
              >
                <PasswordInput value={newPassword} onChangeText={setNewPassword} autoComplete="new-password" />
              </Field>
              <Row gap={t.spacing.sm}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    size="md"
                    onPress={() => {
                      setChangingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      changePassword.reset();
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Save"
                    size="md"
                    onPress={() => void changePassword.run()}
                    loading={changePassword.pending}
                    disabled={!currentPassword || newPassword.length < 8}
                  />
                </View>
              </Row>
            </FadeInView>
          )}
        </Card>
      </View>

      <Group title="Safety">
        <ListRow
          icon="ban"
          tone="warning"
          title="Blocked students"
          subtitle="People you have blocked"
          onPress={() => navigation.navigate('BlockedUsers')}
        />
      </Group>

      <Group title="About">
        <ListRow icon="shield-checkmark" tone="success" title="Privacy policy" external onPress={() => openPage(LEGAL_URLS.privacy)} />
        <Divider spacing={0} />
        <ListRow icon="document-text" tone="neutral" title="Terms of use" external onPress={() => openPage(LEGAL_URLS.terms)} />
        <Divider spacing={0} />
        <ListRow icon="mail" tone="accent" title="Contact support" external onPress={contactSupport} />
      </Group>

      <Group title="Session">
        <ListRow icon="log-out" tone="neutral" title="Sign out" onPress={confirmSignOut} />
        <Divider spacing={0} />
        <ListRow
          icon="trash"
          destructive
          title="Delete account"
          subtitle="Permanently remove your data"
          onPress={() => navigation.navigate('DeleteAccount')}
        />
      </Group>

      <View style={{ alignItems: 'center', gap: 2, marginBottom: t.spacing.xl }}>
        <Caption>Skill Exchange {Constants.expoConfig?.version ?? '1.0.0'}</Caption>
        {__DEV__ ? (
          <Caption numberOfLines={1} style={{ maxWidth: '80%' }}>
            {BASE_URL}
          </Caption>
        ) : null}
      </View>
    </Screen>
  );
}
