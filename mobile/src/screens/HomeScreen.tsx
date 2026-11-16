import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { gamification, matching, notifications, requests, sessions } from '../api/endpoints';
import { MATCH_PEEK_WIDTH, MatchPeek, SessionCard } from '../components/cards';
import { FadeInView, PressableScale, Skeleton } from '../components/motion';
import {
  Avatar,
  Banner,
  Button,
  Caption,
  EmptyState,
  IconButton,
  IconTile,
  Row,
  Screen,
  SectionHeader,
  StatTile,
  Text,
  Title,
  type Tone,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { formatDuration, formatSessionWhen, plural } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The one thing worth doing next, on the brand gradient. It changes with the student's
 * situation, so the top of Home is always an answer to "what now?" rather than a banner
 * that says the same thing every day.
 */
function NextUpCard({
  overline,
  title,
  body,
  action,
  icon,
  onPress,
}: {
  overline: string;
  title: string;
  body: string;
  action: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress(): void;
}) {
  const t = useTheme();
  return (
    <FadeInView style={{ marginBottom: t.spacing.xl }}>
      <LinearGradient
        colors={t.gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ borderRadius: t.radius.xl, padding: t.spacing.xl, overflow: 'hidden' }, t.elevation(3)]}
      >
        {/* Two faint rings in the corner give the flat gradient some depth. */}
        <View
          style={{
            position: 'absolute',
            right: -60,
            top: -60,
            width: 200,
            height: 200,
            borderRadius: 100,
            borderWidth: 28,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: 28,
            top: 26,
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.16)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={22} color="#FFFFFF" />
        </View>

        <Text
          style={{
            color: 'rgba(255,255,255,0.86)',
            fontSize: 11.5,
            lineHeight: 15,
            fontWeight: '700',
            letterSpacing: 0.9,
            textTransform: 'uppercase',
            marginRight: 60,
          }}
        >
          {overline}
        </Text>
        <Text
          numberOfLines={2}
          style={{ color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '800', marginTop: 6, marginRight: 56 }}
        >
          {title}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14.5, lineHeight: 21, marginTop: 6 }}>{body}</Text>
        <Button
          label={action}
          variant="inverse"
          size="md"
          iconRight="arrow-forward"
          fullWidth={false}
          onPress={onPress}
          style={{ marginTop: t.spacing.lg }}
        />
      </LinearGradient>
    </FadeInView>
  );
}

/** A shortcut: a tinted icon over a short label. Four of these make the quick-actions row. */
function Shortcut({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: Tone;
  onPress(): void;
}) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      accessibilityLabel={label}
      style={{ flex: 1, alignItems: 'center', gap: 7, paddingVertical: 4 }}
    >
      <IconTile icon={icon} tone={tone} size={52} />
      <Text numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 17, fontWeight: '600', color: t.colors.text }}>
        {label}
      </Text>
    </PressableScale>
  );
}

function HomeSkeleton() {
  const t = useTheme();
  // Mirrors the real layout, so loading reads as "almost there" rather than "stuck".
  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between', marginBottom: t.spacing.xl }}>
        <View style={{ gap: 8, flex: 1 }}>
          <Skeleton width="34%" height={13} />
          <Skeleton width="52%" height={26} />
        </View>
        <Skeleton width={44} height={44} radius={22} />
      </Row>
      <Skeleton height={190} radius={t.radius.xl} style={{ marginBottom: t.spacing.xl }} />
      <Row gap={t.spacing.sm} style={{ marginBottom: t.spacing.xl }}>
        <Skeleton width="31%" height={108} radius={t.radius.lg} />
        <Skeleton width="31%" height={108} radius={t.radius.lg} />
        <Skeleton width="31%" height={108} radius={t.radius.lg} />
      </Row>
      <Skeleton width="40%" height={20} style={{ marginBottom: t.spacing.md }} />
      <Row gap={t.spacing.md}>
        <Skeleton width={MATCH_PEEK_WIDTH} height={210} radius={t.radius.lg} />
        <Skeleton width={MATCH_PEEK_WIDTH} height={210} radius={t.radius.lg} />
      </Row>
    </Screen>
  );
}

export function HomeScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const load = useCallback(
    async () =>
      Promise.all([
        matching.recommendations({ limit: 8 }),
        sessions.list({ when: 'upcoming', page: 1 }),
        requests.pendingCount(),
        gamification.analytics(),
        // A badge is a nicety; failing to count must not fail the page.
        notifications.unreadCount().catch(() => ({ count: 0 })),
      ]),
    [],
  );

  const state = useAsync(load, []);

  if (state.loading) return <HomeSkeleton />;

  const [matches, upcoming, pending, analytics, unread] = state.data ?? [];
  const firstName = user?.name.split(' ')[0] ?? 'there';
  const hasSkills = (analytics?.skillsTeaching ?? 0) + (analytics?.skillsLearning ?? 0) > 0;
  const pendingCount = pending?.count ?? 0;
  const nextSession = upcoming?.items[0];

  let nextUp: Parameters<typeof NextUpCard>[0];
  if (!hasSkills) {
    nextUp = {
      overline: 'Start here',
      title: 'Add your skills',
      body: 'Tell us what you can teach and what you want to learn. Matches appear the moment you do.',
      action: 'Add skills',
      icon: 'sparkles',
      onPress: () => navigation.navigate('MySkills'),
    };
  } else if (pendingCount > 0) {
    nextUp = {
      overline: 'Waiting for you',
      title: `${plural(pendingCount, 'student')} ${pendingCount === 1 ? 'wants' : 'want'} to learn from you`,
      body: 'Accept to open a chat and start planning a session.',
      action: 'Review requests',
      icon: 'mail-unread',
      onPress: () => navigation.navigate('LearningRequests'),
    };
  } else if (nextSession) {
    const partner =
      nextSession.teacher._id === user?.id ? nextSession.learner.name : nextSession.teacher.name;
    nextUp = {
      overline: `Next session · ${formatSessionWhen(nextSession.scheduledAt)}`,
      title: `${nextSession.skill.name} with ${partner.split(' ')[0]}`,
      body: `${formatDuration(nextSession.durationMinutes)}, ${nextSession.mode === 'ONLINE' ? 'online' : 'in person'}.`,
      action: 'Open session',
      icon: 'calendar',
      onPress: () => navigation.navigate('SessionDetails', { sessionId: nextSession._id }),
    };
  } else {
    nextUp = {
      overline: 'Keep going',
      title: 'Find someone to learn from',
      body: 'Browse students by skill, or send a request to one of your matches below.',
      action: 'Explore',
      icon: 'compass',
      onPress: () => navigation.navigate('Tabs', { screen: 'ExploreTab' }),
    };
  }

  // The hero already shows the next session; the list below starts after it.
  const moreSessions = (upcoming?.items ?? []).slice(nextUp.icon === 'calendar' ? 1 : 0, 3);

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Row style={{ justifyContent: 'space-between', marginBottom: t.spacing.xl }}>
        <View style={{ flex: 1 }}>
          <Caption style={{ fontSize: 14, lineHeight: 19 }}>{greeting()}</Caption>
          <Title numberOfLines={1}>{firstName}</Title>
        </View>
        <Row gap={t.spacing.sm}>
          <IconButton
            icon="notifications-outline"
            accessibilityLabel={
              (unread?.count ?? 0) > 0 ? `Notifications, ${unread?.count} unread` : 'Notifications'
            }
            badge={(unread?.count ?? 0) > 0}
            onPress={() => navigation.navigate('Notifications')}
          />
          <PressableScale
            onPress={() => navigation.navigate('Tabs', { screen: 'ProfileTab' })}
            accessibilityLabel="Your profile"
            scaleTo={0.9}
          >
            <Avatar name={user?.name ?? '?'} uri={user?.profileImage} size={44} />
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

      <NextUpCard {...nextUp} />

      <Row gap={t.spacing.sm} style={{ marginBottom: t.spacing.xl, alignItems: 'stretch' }}>
        <StatTile
          index={0}
          label="Sessions taught"
          value={analytics?.sessionsTaught ?? 0}
          icon="school"
          tone="teach"
        />
        <StatTile
          index={1}
          label="Hours learned"
          value={analytics?.hoursLearned ?? 0}
          icon="book"
          tone="learn"
        />
        <StatTile
          index={2}
          label="Day streak"
          value={analytics?.streakDays ?? 0}
          icon="flame"
          tone="warning"
        />
      </Row>

      <Row style={{ marginBottom: t.spacing.xl }}>
        <Shortcut icon="layers" label="My skills" tone="teach" onPress={() => navigation.navigate('MySkills')} />
        <Shortcut icon="calendar" label="Calendar" tone="accent" onPress={() => navigation.navigate('Calendar')} />
        <Shortcut
          icon="trophy"
          label="Rankings"
          tone="warning"
          onPress={() => navigation.navigate('Leaderboard')}
        />
        <Shortcut icon="ribbon" label="Badges" tone="learn" onPress={() => navigation.navigate('Badges')} />
      </Row>

      <SectionHeader
        title="For you"
        actionLabel={matches && matches.items.length > 0 ? 'See all' : undefined}
        onAction={() => navigation.navigate('Tabs', { screen: 'MatchesTab' })}
      />
      {matches && matches.items.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={MATCH_PEEK_WIDTH + t.spacing.md}
          decelerationRate="fast"
          // Bleeds to the screen edges so cards slide in from off-screen, which says "more this way".
          style={{ marginHorizontal: -t.spacing.page, marginBottom: t.spacing.xl }}
          contentContainerStyle={{
            paddingHorizontal: t.spacing.page,
            paddingTop: 2,
            paddingBottom: t.spacing.sm,
            gap: t.spacing.md,
          }}
        >
          {matches.items.map((match, i) => (
            <MatchPeek
              key={match.id}
              index={i}
              match={match}
              onPress={() => navigation.navigate('StudentProfile', { userId: match.id })}
            />
          ))}
        </ScrollView>
      ) : (
        <EmptyState
          icon="people"
          title="No matches yet"
          message={
            hasSkills
              ? 'Nobody complements your skills right now. Add a few more, or check back soon.'
              : 'Add what you can teach and what you want to learn, and matches will appear here.'
          }
          actionLabel={hasSkills ? 'Browse students' : 'Add skills'}
          onAction={() =>
            hasSkills ? navigation.navigate('Tabs', { screen: 'ExploreTab' }) : navigation.navigate('MySkills')
          }
        />
      )}

      {moreSessions.length > 0 ? (
        <View>
          <SectionHeader title="Coming up" actionLabel="See all" onAction={() => navigation.navigate('MySessions')} />
          {moreSessions.map((session, i) => (
            <SessionCard
              key={session._id}
              index={i}
              session={session}
              currentUserId={user?.id ?? ''}
              onPress={() => navigation.navigate('SessionDetails', { sessionId: session._id })}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
