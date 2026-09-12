import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { View } from 'react-native';
import { gamification, matching, requests, sessions } from '../api/endpoints';
import { MatchCard, SessionCard } from '../components/cards';
import {
  Avatar,
  Banner,
  Body,
  Caption,
  Card,
  EmptyState,
  Heading,
  Row,
  Screen,
  SectionHeader,
  StatTile,
  Title,
} from '../components/ui';
import { PressableScale, SkeletonList, Skeleton } from '../components/motion';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import type { RootStackParamList } from '../navigation/types';

export function HomeScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const load = useCallback(
    async () =>
      Promise.all([
        matching.recommendations({ limit: 3 }),
        sessions.list({ when: 'upcoming', page: 1 }),
        requests.pendingCount(),
        gamification.analytics(),
      ]),
    [],
  );

  const state = useAsync(load, []);

  if (state.loading) {
    // A skeleton that mirrors the real layout reads as "almost there"; a centred
    // spinner on an empty screen reads as "stuck".
    return (
      <Screen scroll>
        <Skeleton width="45%" height={26} style={{ marginBottom: 6 }} />
        <Skeleton width="28%" height={13} style={{ marginBottom: t.spacing.xl }} />
        <Row gap={t.spacing.sm} style={{ marginBottom: t.spacing.xl }}>
          <Skeleton height={84} radius={18} />
          <Skeleton height={84} radius={18} />
          <Skeleton height={84} radius={18} />
        </Row>
        <SkeletonList count={2} lines={2} />
      </Screen>
    );
  }

  const [matches, upcoming, pending, analytics] = state.data ?? [];
  const firstName = user?.name.split(' ')[0] ?? 'there';
  const hasSkills = (analytics?.skillsTeaching ?? 0) + (analytics?.skillsLearning ?? 0) > 0;

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Row style={{ justifyContent: 'space-between', marginBottom: t.spacing.xl }}>
        <View style={{ flex: 1 }}>
          <Caption>Welcome back</Caption>
          <Title numberOfLines={1}>{firstName}</Title>
        </View>
        <Row gap={t.spacing.md}>
          <PressableScale
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="Notifications"
            scaleTo={0.9}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: t.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: t.colors.border,
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={t.colors.text} />
            </View>
          </PressableScale>
          <PressableScale
            onPress={() => navigation.navigate('Tabs', { screen: 'ProfileTab' })}
            accessibilityLabel="Your profile"
            scaleTo={0.9}
          >
            <Avatar name={user?.name ?? '?'} uri={user?.profileImage} size={40} />
          </PressableScale>
        </Row>
      </Row>

      {state.error ? <Banner tone="danger" text={state.error} /> : null}

      {user && !user.emailVerified ? (
        <Banner
          tone="warning"
          text="Confirm your email address to unlock everything. Check your inbox for the link."
        />
      ) : null}

      {!hasSkills ? (
        <Card style={{ marginBottom: t.spacing.lg, backgroundColor: t.colors.primarySoft }}>
          <Heading style={{ color: t.colors.primary }}>Add your skills first</Heading>
          <Body style={{ marginTop: 4, color: t.colors.primary }}>
            Matching needs to know what you can teach and what you want to learn.
          </Body>
          <Row style={{ marginTop: t.spacing.md }}>
            <PressableScale
              onPress={() => navigation.navigate('MySkills')}
              haptic="press"
              accessibilityLabel="Add skills"
              style={{
                backgroundColor: t.colors.primary,
                paddingHorizontal: t.spacing.lg,
                paddingVertical: 11,
                borderRadius: t.radius.md,
              }}
            >
              <Body style={{ color: t.colors.textInverse, fontWeight: '600' }}>Add skills</Body>
            </PressableScale>
          </Row>
        </Card>
      ) : null}

      <Row gap={t.spacing.sm} style={{ marginBottom: t.spacing.xl }}>
        <StatTile
          index={0}
          label="Sessions taught"
          value={analytics?.sessionsTaught ?? 0}
          icon="school-outline"
        />
        <StatTile
          index={1}
          label="Hours learned"
          value={analytics?.hoursLearned ?? 0}
          icon="book-outline"
          tone="accent"
        />
        <StatTile
          index={2}
          label="Day streak"
          value={analytics?.streakDays ?? 0}
          icon="flame-outline"
          tone="warning"
        />
      </Row>

      {(pending?.count ?? 0) > 0 ? (
        <Card
          onPress={() => navigation.navigate('LearningRequests')}
          style={{ marginBottom: t.spacing.xl }}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={t.spacing.md}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: t.colors.warningSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="mail-unread-outline" size={19} color={t.colors.warning} />
              </View>
              <View>
                <Heading>
                  {pending?.count} learning {pending?.count === 1 ? 'request' : 'requests'}
                </Heading>
                <Caption>Waiting for your answer</Caption>
              </View>
            </Row>
            <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
          </Row>
        </Card>
      ) : null}

      <SectionHeader
        title="Upcoming sessions"
        actionLabel={upcoming && upcoming.items.length > 0 ? 'See all' : undefined}
        onAction={() => navigation.navigate('MySessions')}
      />
      {upcoming && upcoming.items.length > 0 ? (
        upcoming.items
          .slice(0, 2)
          .map((session, i) => (
            <SessionCard
              key={session._id}
              index={i}
              session={session}
              currentUserId={user?.id ?? ''}
              onPress={() => navigation.navigate('SessionDetails', { sessionId: session._id })}
            />
          ))
      ) : (
        <Card style={{ marginBottom: t.spacing.lg }}>
          <Body muted>Nothing scheduled. Once you connect with someone, book a session.</Body>
        </Card>
      )}

      <View style={{ marginTop: t.spacing.lg }}>
        <SectionHeader
          title="Recommended for you"
          actionLabel={matches && matches.items.length > 0 ? 'See all' : undefined}
          onAction={() => navigation.navigate('Tabs', { screen: 'MatchesTab' })}
        />
        {matches && matches.items.length > 0 ? (
          matches.items.map((match, i) => (
            <MatchCard
              key={match.id}
              index={i}
              match={match}
              onPress={() => navigation.navigate('StudentProfile', { userId: match.id })}
              onRequest={() =>
                navigation.navigate('SendRequest', {
                  userId: match.id,
                  userName: match.name,
                  ...(match.theyTeachYouWant[0] ? { skillId: match.theyTeachYouWant[0].id } : {}),
                })
              }
            />
          ))
        ) : (
          <EmptyState
            icon="people-outline"
            title="No matches yet"
            message={
              hasSkills
                ? 'Nobody complements your skills right now. Try adding more skills or check back soon.'
                : 'Add what you can teach and what you want to learn, and matches will appear here.'
            }
            actionLabel={hasSkills ? 'Browse students' : 'Add skills'}
            onAction={() =>
              hasSkills
                ? navigation.navigate('Tabs', { screen: 'ExploreTab' })
                : navigation.navigate('MySkills')
            }
          />
        )}
      </View>
    </Screen>
  );
}
