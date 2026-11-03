import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { users as usersApi } from '../api/endpoints';
import { Banner, Body, Button, Card, Field, Input, Row, Screen, Title } from '../components/ui';
import { useAction } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { haptics } from '../utils/haptics';

const WHAT_GOES = [
  'Your profile, photo and skills',
  'Your requests, connections and conversations, including messages and files',
  'Your sessions, and the reviews you wrote and received',
  'Your notifications, reports and blocked list',
];

/**
 * Permanent account deletion, which both app stores require to be possible in the app.
 * A password is asked for again when the account has one; Google-only accounts have none.
 */
export function DeleteAccountScreen() {
  const t = useTheme();
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const needsPassword = user?.hasPassword ?? true;

  const remove = useAction(async () => {
    await usersApi.deleteAccount(needsPassword ? password : undefined);
    haptics.success();
    Alert.alert('Account deleted', 'Your account and its data have been deleted. We have emailed you a confirmation.');
    // The server already revoked every session; this clears the local one.
    await signOut();
    return true;
  });

  function confirm() {
    haptics.warn();
    Alert.alert(
      'Delete your account permanently?',
      'This cannot be undone. Everything listed on this screen is deleted straight away.',
      [
        { text: 'Keep my account', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove.run() },
      ],
    );
  }

  return (
    <Screen scroll>
      <Title>Delete your account</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        Deleting your account is permanent. This is what goes:
      </Body>

      <Card style={{ marginBottom: t.spacing.lg, gap: t.spacing.sm }}>
        {WHAT_GOES.map((line) => (
          <Row key={line} gap={t.spacing.sm} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="trash-outline" size={16} color={t.colors.danger} style={{ marginTop: 2 }} />
            <Body small style={{ flex: 1 }}>
              {line}
            </Body>
          </Row>
        ))}
      </Card>

      <Body small muted style={{ marginBottom: t.spacing.lg }}>
        Students you had upcoming sessions with will be told those sessions are cancelled.
      </Body>

      {remove.error ? <Banner tone="danger" text={remove.error} /> : null}

      {needsPassword ? (
        <Field label="Enter your password to confirm" error={remove.fieldErrors?.password}>
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            placeholder="Your password"
          />
        </Field>
      ) : null}

      <View style={{ marginTop: t.spacing.md }}>
        <Button
          label="Delete my account"
          variant="danger"
          icon="trash-outline"
          onPress={confirm}
          loading={remove.pending}
          disabled={needsPassword && password.length === 0}
        />
      </View>
    </Screen>
  );
}
