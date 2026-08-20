import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { sessions as sessionsApi, skills as skillsApi, users as usersApi } from '../api/endpoints';
import {
  Banner,
  Body,
  Button,
  Caption,
  Chip,
  Field,
  Input,
  LoadingView,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { useAction, useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import type { SessionMode } from '../types';
import type { RootStackParamList } from '../navigation/types';

const DURATIONS = [30, 45, 60, 90, 120];
const TIMES = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

/**
 * Session scheduling.
 *
 * Uses chip pickers for day, time and duration rather than a native datetime picker:
 * it keeps the flow to one screen, avoids a platform-specific dependency, and the set
 * of realistic session times is small enough to enumerate.
 */
export function ScheduleSessionScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { partnerId, partnerName, skillId } =
    useRoute<RouteProp<RootStackParamList, 'ScheduleSession'>>().params;

  const [role, setRole] = useState<'TEACHER' | 'LEARNER'>('LEARNER');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(skillId ?? null);
  const [dayOffset, setDayOffset] = useState(1);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState<SessionMode>('ONLINE');
  const [meetingLink, setMeetingLink] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(
    async () => Promise.all([usersApi.profile(partnerId), skillsApi.mine()]),
    [partnerId],
  );
  const state = useAsync(load, [partnerId]);

  const theirTeaches = state.data?.[0]?.teaches ?? [];
  const myTeaches = state.data?.[1]?.teaches ?? [];

  // The skill list depends on who is teaching, so reset the choice when the role flips.
  const skillOptions =
    role === 'LEARNER'
      ? theirTeaches.map((s) => ({ id: s.skill.id, name: s.skill.name }))
      : myTeaches.map((s) => ({ id: s.skill._id, name: s.skill.name }));

  useEffect(() => {
    if (selectedSkill && !skillOptions.some((s) => s.id === selectedSkill)) {
      setSelectedSkill(skillOptions[0]?.id ?? null);
    } else if (!selectedSkill && skillOptions.length === 1) {
      setSelectedSkill(skillOptions[0]?.id ?? null);
    }
  }, [role, skillOptions, selectedSkill]);

  const scheduledAt = dayjs()
    .add(dayOffset, 'day')
    .hour(Number(time.slice(0, 2)))
    .minute(Number(time.slice(3, 5)))
    .second(0)
    .millisecond(0);

  const inPast = scheduledAt.isBefore(dayjs());

  const submit = useAction(async () => {
    if (!selectedSkill) return null;
    const session = await sessionsApi.create({
      partnerId,
      role,
      skillId: selectedSkill,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: duration,
      mode,
      ...(mode === 'ONLINE' ? { meetingLink: meetingLink.trim() } : { location: location.trim() }),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    navigation.replace('SessionDetails', { sessionId: session._id });
    return session;
  });

  if (state.loading) return <LoadingView />;

  const detailsReady =
    mode === 'ONLINE' ? meetingLink.trim().length > 0 : location.trim().length > 0;
  const canSubmit = Boolean(selectedSkill) && detailsReady && !inPast;

  return (
    <Screen scroll>
      <Title>Schedule a session</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        With {partnerName}.
      </Body>

      {state.error ? <Banner tone="danger" text={state.error} /> : null}
      {submit.error ? <Banner tone="danger" text={submit.error} /> : null}

      <Field label="Who is teaching?">
        <Row gap={t.spacing.sm}>
          <Chip
            label={`${partnerName.split(' ')[0]} teaches me`}
            selected={role === 'LEARNER'}
            onPress={() => setRole('LEARNER')}
          />
          <Chip
            label="I teach them"
            selected={role === 'TEACHER'}
            onPress={() => setRole('TEACHER')}
          />
        </Row>
      </Field>

      <Field
        label="Skill"
        hint={
          skillOptions.length === 0
            ? role === 'LEARNER'
              ? `${partnerName} has not listed any teaching skills.`
              : 'You have not listed any teaching skills yet.'
            : undefined
        }
      >
        <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
          {skillOptions.map((skill) => (
            <Chip
              key={skill.id}
              label={skill.name}
              selected={selectedSkill === skill.id}
              onPress={() => setSelectedSkill(skill.id)}
            />
          ))}
        </Row>
      </Field>

      <Field label="Day">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={t.spacing.sm}>
            {Array.from({ length: 14 }, (_, i) => i + 1).map((offset) => {
              const d = dayjs().add(offset, 'day');
              const active = dayOffset === offset;
              return (
                <Pressable
                  key={offset}
                  onPress={() => setDayOffset(offset)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: t.spacing.md,
                    paddingVertical: t.spacing.sm,
                    borderRadius: t.radius.md,
                    alignItems: 'center',
                    minWidth: 58,
                    backgroundColor: active ? t.colors.primary : t.colors.surface,
                    borderWidth: 1,
                    borderColor: active ? t.colors.primary : t.colors.border,
                  }}
                >
                  <Caption style={{ color: active ? t.colors.textInverse : t.colors.textMuted }}>
                    {d.format('ddd')}
                  </Caption>
                  <Body style={{ color: active ? t.colors.textInverse : t.colors.text }}>
                    {d.format('D')}
                  </Body>
                  <Caption style={{ color: active ? t.colors.textInverse : t.colors.textMuted }}>
                    {d.format('MMM')}
                  </Caption>
                </Pressable>
              );
            })}
          </Row>
        </ScrollView>
      </Field>

      <Field label="Start time">
        <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
          {TIMES.map((option) => (
            <Chip
              key={option}
              label={dayjs(`2000-01-01T${option}`).format('h:mm A')}
              selected={time === option}
              onPress={() => setTime(option)}
            />
          ))}
        </Row>
      </Field>

      <Field label="Duration">
        <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
          {DURATIONS.map((minutes) => (
            <Chip
              key={minutes}
              label={minutes >= 60 ? `${minutes / 60} hr${minutes > 60 ? 's' : ''}` : `${minutes} min`}
              selected={duration === minutes}
              onPress={() => setDuration(minutes)}
            />
          ))}
        </Row>
      </Field>

      <Field label="How will you meet?">
        <Row gap={t.spacing.sm}>
          <Chip
            label="Online"
            icon="videocam-outline"
            selected={mode === 'ONLINE'}
            onPress={() => setMode('ONLINE')}
          />
          <Chip
            label="In person"
            icon="location-outline"
            selected={mode === 'OFFLINE'}
            onPress={() => setMode('OFFLINE')}
          />
        </Row>
      </Field>

      {mode === 'ONLINE' ? (
        <Field label="Meeting link" error={submit.fieldErrors?.meetingLink}>
          <Input
            value={meetingLink}
            onChangeText={setMeetingLink}
            placeholder="https://meet.google.com/abc-defg-hij"
            autoCapitalize="none"
            keyboardType="url"
            error={Boolean(submit.fieldErrors?.meetingLink)}
          />
        </Field>
      ) : (
        <Field label="Where?" error={submit.fieldErrors?.location}>
          <Input
            value={location}
            onChangeText={setLocation}
            placeholder="Central library, 2nd floor study room"
            error={Boolean(submit.fieldErrors?.location)}
          />
        </Field>
      )}

      <Field label="Notes (optional)">
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="What should you both prepare beforehand?"
          multiline
          numberOfLines={3}
          maxLength={1000}
          style={{ minHeight: 76, textAlignVertical: 'top' }}
        />
      </Field>

      <View
        style={{
          backgroundColor: t.colors.surfaceAlt,
          borderRadius: t.radius.md,
          padding: t.spacing.md,
          marginBottom: t.spacing.lg,
        }}
      >
        <Caption>Scheduled for</Caption>
        <Body style={{ marginTop: 2 }}>
          {scheduledAt.format('dddd D MMMM, h:mm A')} · {duration} minutes
        </Body>
      </View>

      {inPast ? <Banner tone="warning" text="That time has already passed. Pick a later slot." /> : null}

      <Button
        label="Schedule session"
        icon="calendar-outline"
        onPress={() => void submit.run()}
        loading={submit.pending}
        disabled={!canSubmit}
      />
      <View style={{ height: t.spacing.xl }} />
    </Screen>
  );
}
