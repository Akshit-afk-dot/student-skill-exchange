import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
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
  LoadingView,
  Row,
  Screen,
  SectionHeader,
  StatTile,
  Title,
} from '../components/ui';
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

  if (state.loading) return <LoadingView label="Getting things ready…" />;

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
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={24} color={t.colors.text} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Tabs', { screen: 'ProfileTab' })}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
          >
            <Avatar name={user?.name ?? '?'} uri={user?.profileImage} size={36} />
          </Pressable>
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
            <Pressable
              onPress={() => navigation.navigate('MySkills')}
              accessibilityRole="button"
              style={{
                backgroundColor: t.colors.primary,
                paddingHorizontal: t.spacing.lg,
                paddingVertical: 10,
                borderRadius: t.radius.md,
              }}
            >
              <Body style={{ color: t.colors.textInverse, fontWeight: '600' }}>Add skills</Body>
            </Pressable>
          </Row>
        </Card>
      ) : null}

      <Row gap={t.spacing.sm} style={{ marginBottom: t.spacing.xl }}>
        <StatTile
          label="Sessions taught"
          value={analytics?.sessionsTaught ?? 0}
          icon="school-outline"
        />
        <StatTile
          label="Hours learned"
          value={analytics?.hoursLearned ?? 0}
          icon="book-outline"
          tone="success"
        />
        <StatTile
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
          .map((session) => (
            <SessionCard
              key={session._id}
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
          matches.items.map((match) => (
            <MatchCard
              key={match.id}
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
