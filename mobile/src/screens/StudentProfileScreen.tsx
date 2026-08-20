import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { View } from 'react-native';
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
  Heading,
  LoadingView,
  Row,
  Screen,
  SectionHeader,
  StarRating,
  Title,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { LEVEL_LABEL, plural, reasonText, slotLabel } from '../utils/format';
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

  if (state.loading) return <LoadingView />;
  if (state.error || !state.data) {
    return <ErrorView message={state.error ?? 'Profile not found'} onRetry={state.reload} />;
  }

  const [profile, connection, match] = state.data;

  const skillNames = new Map<string, string>();
  for (const s of match?.theyTeachYouWant ?? []) skillNames.set(s.id, s.name);
  for (const s of match?.youTeachTheyWant ?? []) skillNames.set(s.id, s.name);

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Row gap={t.spacing.lg} style={{ alignItems: 'flex-start' }}>
        <Avatar name={profile.name} uri={profile.profileImage} size={72} online={profile.isOnline} />
        <View style={{ flex: 1 }}>
          <Title numberOfLines={2}>{profile.name}</Title>
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
        <Card style={{ marginTop: t.spacing.lg }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Heading>{match.matchPercent}% match</Heading>
            {match.twoWay ? <Chip label="Two-way" tone="success" icon="swap-horizontal" /> : null}
          </Row>
          <View style={{ marginTop: t.spacing.md, gap: 5 }}>
            {match.reasons
              .map((r) => reasonText(r, skillNames))
              .filter(Boolean)
              .map((text) => (
                <Row key={text} gap={6}>
                  <Ionicons name="checkmark-circle" size={14} color={t.colors.success} />
                  <Body small style={{ flex: 1 }}>
                    {text}
                  </Body>
                </Row>
              ))}
          </View>
        </Card>
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
          {connection.connected && connection.conversationId ? (
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
        </View>
      ) : (
        <Banner tone="primary" text="This is how other students see your profile." />
      )}
    </Screen>
  );
}
