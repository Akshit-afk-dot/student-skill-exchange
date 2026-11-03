import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { BASE_URL } from '../api/client';
import { auth as authApi } from '../api/endpoints';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Field,
  Input,
  Row,
  Screen,
  SectionHeader,
  Title,
} from '../components/ui';
import { useAction } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { LEGAL_URLS, contactSupport, openPage } from '../utils/legal';
import type { RootStackParamList } from '../navigation/types';

/** One tappable line in a settings card. */
function SettingsRow({
  label,
  icon,
  onPress,
  external = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  external?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={external ? 'link' : 'button'}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={t.spacing.md} style={{ flex: 1 }}>
          <Ionicons name={icon} size={18} color={t.colors.textMuted} />
          <Body>{label}</Body>
        </Row>
        <Ionicons
          name={external ? 'open-outline' : 'chevron-forward'}
          size={17}
          color={t.colors.textMuted}
        />
      </Row>
    </Pressable>
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
    Alert.alert('Sign out?', 'You will need your password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen scroll>
      <Title>Settings</Title>

      {notice ? <Banner tone="success" text={notice} /> : null}
      {changePassword.error ? <Banner tone="danger" text={changePassword.error} /> : null}
      {resendVerification.error ? <Banner tone="danger" text={resendVerification.error} /> : null}

      <SectionHeader title="Account" />
      <Card style={{ marginBottom: t.spacing.xl }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Caption>Signed in as</Caption>
            <Body numberOfLines={1}>{user?.email}</Body>
          </View>
          {user?.emailVerified ? (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={t.colors.success}
              accessibilityLabel="Email verified"
            />
          ) : null}
        </Row>

        {!user?.emailVerified ? (
          <>
            <Divider />
            <Body small muted style={{ marginBottom: t.spacing.sm }}>
              Your email is not verified yet. You need to verify it before you can send requests
              and messages.
            </Body>
            <Button
              label="Resend verification email"
              variant="secondary"
              onPress={() => void resendVerification.run()}
              loading={resendVerification.pending}
              fullWidth={false}
            />
          </>
        ) : null}

        <Divider />

        <SettingsRow
          label="Edit profile"
          icon="person-outline"
          onPress={() => navigation.navigate('EditProfile')}
        />
      </Card>

      <SectionHeader title="Security" />
      <Card style={{ marginBottom: t.spacing.xl }}>
        {!user?.hasPassword ? (
          <Body small muted>
            You sign in with Google, so there is no password to change. Use “forgot
            password” on the sign-in screen if you want to set one.
          </Body>
        ) : !changingPassword ? (
          <Button
            label="Change password"
            variant="secondary"
            icon="key-outline"
            onPress={() => setChangingPassword(true)}
          />
        ) : (
          <>
            <Field label="Current password" error={changePassword.fieldErrors?.currentPassword}>
              <Input
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
              />
            </Field>
            <Field
              label="New password"
              error={changePassword.fieldErrors?.newPassword}
              hint="At least 8 characters, with a letter and a number."
            >
              <Input
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
              />
            </Field>
            <Row gap={t.spacing.sm}>
              <Button
                label="Save"
                onPress={() => void changePassword.run()}
                loading={changePassword.pending}
                disabled={!currentPassword || newPassword.length < 8}
                fullWidth={false}
                style={{ flex: 1 }}
              />
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setChangingPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  changePassword.reset();
                }}
                fullWidth={false}
                style={{ flex: 1 }}
              />
            </Row>
          </>
        )}
      </Card>

      <SectionHeader title="Safety" />
      <Card style={{ marginBottom: t.spacing.xl }}>
        <Body small muted style={{ marginBottom: t.spacing.md }}>
          If another student behaves badly, report or block them from their profile. Reports go to
          the moderation team, and we act on harassment, spam and fake profiles.
        </Body>
        <Divider />
        <SettingsRow
          label="Blocked students"
          icon="ban-outline"
          onPress={() => navigation.navigate('BlockedUsers')}
        />
      </Card>

      <SectionHeader title="About" />
      <Card style={{ marginBottom: t.spacing.xl, gap: t.spacing.md }}>
        <SettingsRow
          label="Privacy policy"
          icon="shield-outline"
          external
          onPress={() => openPage(LEGAL_URLS.privacy)}
        />
        <SettingsRow
          label="Terms of use"
          icon="document-text-outline"
          external
          onPress={() => openPage(LEGAL_URLS.terms)}
        />
        <SettingsRow label="Contact support" icon="mail-outline" external onPress={contactSupport} />
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <Caption>Version</Caption>
          <Caption>{Constants.expoConfig?.version ?? '1.0.0'}</Caption>
        </Row>
        {__DEV__ ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Caption>Server</Caption>
            <Caption numberOfLines={1} style={{ maxWidth: '65%' }}>
              {BASE_URL}
            </Caption>
          </Row>
        ) : null}
      </Card>

      <Button label="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} />
      <View style={{ marginTop: t.spacing.md }}>
        <Button
          label="Delete account"
          variant="ghost"
          icon="trash-outline"
          onPress={() => navigation.navigate('DeleteAccount')}
        />
      </View>
      <View style={{ height: t.spacing.xl }} />
    </Screen>
  );
}
