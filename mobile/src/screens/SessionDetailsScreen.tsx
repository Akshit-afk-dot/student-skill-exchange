import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Linking, View } from 'react-native';
import { sessions as sessionsApi } from '../api/endpoints';
import {
  Avatar,
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Divider,
  ErrorView,
  Heading,
  LoadingView,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { useAction, useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { formatDuration, formatSessionWhen, statusLabel, statusTone } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

export function SessionDetailsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { sessionId } = useRoute<RouteProp<RootStackParamList, 'SessionDetails'>>().params;
  const { user } = useAuth();

  const state = useAsync(async () => sessionsApi.get(sessionId), [sessionId]);

  const confirm = useAction(async () => {
    await sessionsApi.confirm(sessionId);
    state.reload();
  });

  const complete = useAction(async () => {
    const result = await sessionsApi.complete(sessionId);
    state.reload();
    if (result.fullyCompleted) {
      Alert.alert('Session complete', 'You can now leave a rating.', [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Rate now',
          onPress: () =>
            navigation.navigate('WriteReview', {
              sessionId,
              revieweeName: partnerName,
            }),
        },
      ]);
    } else {
      Alert.alert('Marked as done', result.message);
    }
    return result;
  });

  const cancel = useAction(async (reason: string) => {
    await sessionsApi.cancel(sessionId, reason);
    state.reload();
  });

  if (state.loading) return <LoadingView />;
  if (state.error || !state.data) {
    return <ErrorView message={state.error ?? 'Session not found'} onRetry={state.reload} />;
  }

  const session = state.data;
  const isTeacher = session.teacher._id === user?.id;
  const partner = isTeacher ? session.learner : session.teacher;
  const partnerName = partner.name;

  const hasStarted = new Date(session.scheduledAt).getTime() <= Date.now();
  const isOpen = session.status === 'SCHEDULED' || session.status === 'CONFIRMED';
  const alreadyMarkedDone = session.completedBy?.some((id) => String(id) === user?.id) ?? false;

  function confirmCancel() {
    Alert.alert('Cancel this session?', 'The other student will be notified.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel session',
        style: 'destructive',
        onPress: () => void cancel.run('Cancelled by the other student'),
      },
    ]);
  }

  const actionError = confirm.error ?? complete.error ?? cancel.error;
  const busy = confirm.pending || complete.pending || cancel.pending;

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Row style={{ justifyContent: 'space-between', marginBottom: t.spacing.md }}>
        <Chip label={statusLabel(session.status)} tone={statusTone(session.status)} />
        <Chip
          label={session.mode === 'ONLINE' ? 'Online' : 'In person'}
          icon={session.mode === 'ONLINE' ? 'videocam-outline' : 'location-outline'}
        />
      </Row>

      <Title>{session.skill?.name ?? 'Session'}</Title>
      <Body muted style={{ marginTop: 4 }}>
        {isTeacher ? `You are teaching ${partnerName}` : `${partnerName} is teaching you`}
      </Body>

      {actionError ? <Banner tone="danger" text={actionError} /> : null}

      <Card style={{ marginTop: t.spacing.lg }}>
        <Row gap={t.spacing.md}>
          <Ionicons name="time-outline" size={19} color={t.colors.primary} />
          <View style={{ flex: 1 }}>
            <Body>{formatSessionWhen(session.scheduledAt)}</Body>
            <Caption>{formatDuration(session.durationMinutes)}</Caption>
          </View>
        </Row>

        <Divider />

        <Row gap={t.spacing.md}>
          <Avatar name={partner.name} uri={partner.profileImage} size={38} />
          <View style={{ flex: 1 }}>
            <Body>{partner.name}</Body>
            <Caption>{isTeacher ? 'Your student' : 'Your teacher'}</Caption>
          </View>
          <Chip
            label="Profile"
            onPress={() => navigation.navigate('StudentProfile', { userId: partner._id })}
          />
        </Row>

        {session.mode === 'ONLINE' && session.meetingLink ? (
          <>
            <Divider />
            <Row gap={t.spacing.md}>
              <Ionicons name="link-outline" size={19} color={t.colors.primary} />
              <View style={{ flex: 1 }}>
                <Body small numberOfLines={1}>
                  {session.meetingLink}
                </Body>
                <Caption>Meeting link</Caption>
              </View>
              <Chip
                label="Join"
                tone="primary"
                onPress={() => {
                  // Opening an external link can fail on a device with no browser
                  // configured; surface that rather than silently doing nothing.
                  void Linking.openURL(session.meetingLink as string).catch(() =>
                    Alert.alert('Could not open the link', session.meetingLink ?? ''),
                  );
                }}
              />
            </Row>
          </>
        ) : null}

        {session.mode === 'OFFLINE' && session.location ? (
          <>
            <Divider />
            <Row gap={t.spacing.md}>
              <Ionicons name="location-outline" size={19} color={t.colors.primary} />
              <View style={{ flex: 1 }}>
                <Body small>{session.location}</Body>
                <Caption>Where to meet</Caption>
              </View>
            </Row>
          </>
        ) : null}

        {session.notes ? (
          <>
            <Divider />
            <View>
              <Caption>Notes</Caption>
              <Body small style={{ marginTop: 3 }}>
                {session.notes}
              </Body>
            </View>
          </>
        ) : null}
      </Card>

      {session.status === 'CANCELLED' ? (
        <Banner
          tone="danger"
          text={session.cancelReason ? `Cancelled: ${session.cancelReason}` : 'This session was cancelled.'}
        />
      ) : null}

      {isOpen && hasStarted && alreadyMarkedDone ? (
        <Banner
          tone="primary"
          text={`Waiting for ${partnerName.split(' ')[0]} to confirm the session happened.`}
        />
      ) : null}

      <View style={{ marginTop: t.spacing.xl, gap: t.spacing.md }}>
        {session.status === 'SCHEDULED' && !hasStarted ? (
          <Button
            label="Confirm I will be there"
            icon="checkmark-circle-outline"
            onPress={() => void confirm.run()}
            loading={confirm.pending}
            disabled={busy}
          />
        ) : null}

        {isOpen && hasStarted && !alreadyMarkedDone ? (
          <Button
            label="Mark as completed"
            icon="checkmark-done-outline"
            onPress={() => void complete.run()}
            loading={complete.pending}
            disabled={busy}
          />
        ) : null}

        {session.status === 'COMPLETED' ? (
          <Button
            label="Leave a rating"
            icon="star-outline"
            onPress={() =>
              navigation.navigate('WriteReview', { sessionId, revieweeName: partnerName })
            }
          />
        ) : null}

        {isOpen ? (
          <>
            {!hasStarted ? (
              <Button
                label="Reschedule"
                variant="secondary"
                icon="calendar-outline"
                onPress={() =>
                  navigation.navigate('ScheduleSession', {
                    partnerId: partner._id,
                    partnerName,
                  })
                }
                disabled={busy}
              />
            ) : null}
            <Button
              label="Cancel session"
              variant="ghost"
              onPress={confirmCancel}
              disabled={busy}
            />
          </>
        ) : null}
      </View>

      <View style={{ height: t.spacing.xl }} />
    </Screen>
  );
}
