import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { Alert, View } from 'react-native';
import { connections, matching, users as usersApi } from '../api/endpoints';
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
  LoadingView,
  Overline,
  Row,
  Screen,
  SectionHeader,
  StarRating,
  Title,
  VerifiedName,
} from '../components/ui';
import { ScoreRing, ScoreBar } from '../components/ScoreRing';
import { FadeInView } from '../components/motion';
import { useAction, useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { LEVEL_LABEL, plural, reasonText, slotLabel } from '../utils/format';
import { haptics } from '../utils/haptics';
import type { RootStackParamList } from '../navigation/types';

export function StudentProfileScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId } = useRoute<RouteProp<RootStackParamList, 'StudentProfile'>>().params;
  const { user } = useAuth();

  const isSelf = user?.id === userId;

  const load = useCallback(
    async () =>
      Promise.all([
        usersApi.profile(userId),
        connections.with(userId).catch(() => ({ connected: false, conversationId: null })),
        // The match explanation is a nice-to-have; a failure should not blank the page.
        isSelf ? Promise.resolve(null) : matching.explain(userId).catch(() => null),
      ]),
    [userId, isSelf],
  );

  const state = useAsync(load, [userId]);

  const setBlocked = useAction(async (blocked: boolean) => {
    if (blocked) {
      await usersApi.block(userId);
      haptics.warn();
    } else {
      await usersApi.unblock(userId);
      haptics.success();
    }
    state.reload();
    return true;
  });

  if (state.loading) return <LoadingView />;
  if (state.error || !state.data) {
    return <ErrorView message={state.error ?? 'Profile not found'} onRetry={state.reload} />;
  }

  const [profile, connection, match] = state.data;

  function confirmBlock() {
    Alert.alert(
      `Block ${profile.name}?`,
      'You will not see each other in matches or search, and neither of you can send requests or messages. Any connection between you ends. We do not tell them.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void setBlocked.run(true) },
      ],
    );
  }

  const skillNames = new Map<string, string>();
  for (const s of match?.theyTeachYouWant ?? []) skillNames.set(s.id, s.name);
  for (const s of match?.youTeachTheyWant ?? []) skillNames.set(s.id, s.name);

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Row gap={t.spacing.lg} style={{ alignItems: 'flex-start' }}>
        <Avatar name={profile.name} uri={profile.profileImage} size={72} online={profile.isOnline} />
        <View style={{ flex: 1 }}>
          <VerifiedName name={profile.name} verified={profile.verified} size="title" />
          {profile.college ? (
            <Body muted style={{ marginTop: 2 }}>
              {profile.college}
              {profile.department ? ` · ${profile.department}` : ''}
              {profile.year ? ` · Year ${profile.year}` : ''}
            </Body>
          ) : null}
          <Row gap={t.spacing.md} style={{ marginTop: t.spacing.sm }}>
            <StarRating value={profile.rating.average} count={profile.rating.count} />
            <Row gap={4}>
              <Ionicons name="flame-outline" size={14} color={t.colors.textMuted} />
              <Caption>{profile.stats.points} pts</Caption>
            </Row>
          </Row>
        </View>
      </Row>

      {match ? (
        <FadeInView delay={120}>
          <Card style={{ marginTop: t.spacing.lg }} elevated={2}>
            <Row gap={t.spacing.lg}>
              <ScoreRing
                percent={match.matchPercent}
                size={86}
                twoWay={match.twoWay}
                label="match"
                delay={200}
              />
              <View style={{ flex: 1, gap: 5 }}>
                {match.twoWay ? (
                  <Row style={{ marginBottom: 2 }}>
                    <Chip label="Two-way exchange" tone="success" icon="swap-horizontal" />
                  </Row>
                ) : null}
                {match.reasons
                  .map((r) => reasonText(r, skillNames))
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((text) => (
                    <Row key={text} gap={6}>
                      <Ionicons name="checkmark-circle" size={14} color={t.colors.success} />
                      <Caption style={{ flex: 1, lineHeight: 17 }}>{text}</Caption>
                    </Row>
                  ))}
              </View>
            </Row>

            {/* The component breakdown. Showing the working makes the score
                auditable instead of asking the student to trust a number. */}
            <View
              style={{
                marginTop: t.spacing.lg,
                paddingTop: t.spacing.lg,
                borderTopWidth: 1,
                borderTopColor: t.colors.border,
              }}
            >
              <Overline style={{ marginBottom: t.spacing.md }}>How this score is built</Overline>
              <ScoreBar label="Skill fit" value={match.breakdown.skill ?? 0} weight={0.4} index={0} />
              <ScoreBar
                label="Shared free time"
                value={match.breakdown.availability ?? 0}
                weight={0.2}
                index={1}
              />
              <ScoreBar
                label="Experience level"
                value={match.breakdown.experience ?? 0}
                weight={0.15}
                index={2}
              />
              <ScoreBar label="Rating" value={match.breakdown.rating ?? 0} weight={0.15} index={3} />
              <ScoreBar
                label="Location"
                value={match.breakdown.location ?? 0}
                weight={0.1}
                index={4}
              />
            </View>
          </Card>
        </FadeInView>
      ) : null}

      {profile.bio ? (
        <View style={{ marginTop: t.spacing.xl }}>
          <SectionHeader title="About" />
          <Body>{profile.bio}</Body>
        </View>
      ) : null}

      <View style={{ marginTop: t.spacing.xl }}>
        <SectionHeader title="Can teach" />
        {profile.teaches.length === 0 ? (
          <Body muted>No teaching skills listed yet.</Body>
        ) : (
          profile.teaches.map((entry) => (
            <Row key={entry.id} style={{ justifyContent: 'space-between', paddingVertical: 7 }}>
              <Body style={{ flex: 1 }}>{entry.skill.name}</Body>
              <Chip label={LEVEL_LABEL[entry.level]} tone="primary" />
            </Row>
          ))
        )}
      </View>

      <View style={{ marginTop: t.spacing.xl }}>
        <SectionHeader title="Wants to learn" />
        {profile.learns.length === 0 ? (
          <Body muted>No learning goals listed yet.</Body>
        ) : (
          profile.learns.map((entry) => (
            <Row key={entry.id} style={{ justifyContent: 'space-between', paddingVertical: 7 }}>
              <Body style={{ flex: 1 }}>{entry.skill.name}</Body>
              <Chip label={LEVEL_LABEL[entry.level]} tone="warning" />
            </Row>
          ))
        )}
      </View>

      {profile.availability.length > 0 ? (
        <View style={{ marginTop: t.spacing.xl }}>
          <SectionHeader title="Usually free" />
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
            {profile.availability.map((slot, i) => (
              <Chip key={`${slot.day}-${slot.start}-${i}`} label={slotLabel(slot)} />
            ))}
          </Row>
        </View>
      ) : null}

      <View style={{ marginTop: t.spacing.xl }}>
        <SectionHeader
          title="Reviews"
          actionLabel={profile.reviewSummary.count > 0 ? 'See all' : undefined}
          onAction={() =>
            navigation.navigate('Reviews', { userId: profile.id, userName: profile.name })
          }
        />
        {profile.reviewSummary.count === 0 ? (
          <Body muted>No reviews yet.</Body>
        ) : (
          <Row gap={t.spacing.lg}>
            <View>
              <Title>{profile.reviewSummary.average.toFixed(1)}</Title>
              <Caption>{plural(profile.reviewSummary.count, 'review')}</Caption>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = profile.reviewSummary.distribution[String(star)] ?? 0;
                const pct = profile.reviewSummary.count
                  ? (count / profile.reviewSummary.count) * 100
                  : 0;
                return (
                  <Row key={star} gap={6}>
                    <Caption style={{ width: 10 }}>{star}</Caption>
                    <View
                      style={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: t.colors.surfaceAlt,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{ width: `${pct}%`, height: '100%', backgroundColor: t.colors.star }}
                      />
                    </View>
                    <Caption style={{ width: 18, textAlign: 'right' }}>{count}</Caption>
                  </Row>
                );
              })}
            </View>
          </Row>
        )}
      </View>

      {!isSelf ? (
        <View style={{ marginTop: t.spacing.xxl, gap: t.spacing.md }}>
          <Divider />
          {setBlocked.error ? <Banner tone="danger" text={setBlocked.error} /> : null}
          {profile.blockedByMe ? (
            <>
              <Banner
                tone="warning"
                text={`You have blocked ${profile.name}. You cannot find, request or message each other.`}
              />
              <Button
                label="Unblock"
                variant="secondary"
                icon="checkmark-circle-outline"
                onPress={() => void setBlocked.run(false)}
                loading={setBlocked.pending}
              />
            </>
          ) : connection.connected && connection.conversationId ? (
            <>
              <Button
                label="Open chat"
                icon="chatbubble-outline"
                onPress={() =>
                  navigation.navigate('Chat', {
                    conversationId: connection.conversationId as string,
                    partnerName: profile.name,
                    partnerId: profile.id,
                  })
                }
              />
              <Button
                label="Schedule a session"
                variant="secondary"
                icon="calendar-outline"
                onPress={() =>
                  navigation.navigate('ScheduleSession', {
                    partnerId: profile.id,
                    partnerName: profile.name,
                  })
                }
              />
            </>
          ) : (
            <Button
              label="Send a learning request"
              icon="paper-plane-outline"
              onPress={() =>
                navigation.navigate('SendRequest', {
                  userId: profile.id,
                  userName: profile.name,
                })
              }
            />
          )}

          <Button
            label="Report this student"
            variant="ghost"
            icon="flag-outline"
            onPress={() =>
              navigation.navigate('ReportUser', { userId: profile.id, userName: profile.name })
            }
          />
          {!profile.blockedByMe ? (
            <Button
              label="Block this student"
              variant="ghost"
              icon="ban-outline"
              onPress={confirmBlock}
              loading={setBlocked.pending}
            />
          ) : null}
        </View>
      ) : (
        <Banner tone="primary" text="This is how other students see your profile." />
      )}
    </Screen>
  );
}
