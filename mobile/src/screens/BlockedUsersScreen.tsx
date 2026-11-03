import { Alert, View } from 'react-native';
import { users as usersApi } from '../api/endpoints';
import {
  Avatar,
  Banner,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  ErrorView,
  LoadingView,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { AnimatedListItem } from '../components/motion';
import { useAction, useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { haptics } from '../utils/haptics';
import type { BlockedStudent } from '../types';

export function BlockedUsersScreen() {
  const t = useTheme();
  const state = useAsync(() => usersApi.blocked(), []);

  const unblock = useAction(async (student: BlockedStudent) => {
    await usersApi.unblock(student.id);
    haptics.success();
    state.reload();
    return true;
  });

  function confirmUnblock(student: BlockedStudent) {
    Alert.alert(
      `Unblock ${student.name}?`,
      'You will be able to find each other again. Your old connection is not restored: either of you would need to send a new request.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => void unblock.run(student) },
      ],
    );
  }

  if (state.loading) return <LoadingView />;
  if (state.error || !state.data) {
    return <ErrorView message={state.error ?? 'Could not load blocked students'} onRetry={state.reload} />;
  }

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Title>Blocked students</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        You and the students you block cannot find, request or message each other. They are not
        told.
      </Body>

      {unblock.error ? <Banner tone="danger" text={unblock.error} /> : null}

      {state.data.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="No one is blocked"
          message="If a student makes you uncomfortable, you can block them from their profile."
        />
      ) : (
        state.data.map((student, index) => (
          <AnimatedListItem key={student.id} index={index}>
            <Card style={{ marginBottom: t.spacing.md }}>
              <Row gap={t.spacing.md}>
                <Avatar name={student.name} uri={student.profileImage} size={44} />
                <View style={{ flex: 1 }}>
                  <Body numberOfLines={1}>{student.name}</Body>
                  {student.college ? <Caption numberOfLines={1}>{student.college}</Caption> : null}
                </View>
                <Button
                  label="Unblock"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => confirmUnblock(student)}
                  loading={unblock.pending}
                />
              </Row>
            </Card>
          </AnimatedListItem>
        ))
      )}
    </Screen>
  );
}
