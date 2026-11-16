import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback } from 'react';
import { View } from 'react-native';
import { users as usersApi } from '../api/endpoints';
import { Skeleton } from '../components/motion';
import {
  Avatar,
  Banner,
  Body,
  Caption,
  Card,
  Chip,
  Divider,
  IconButton,
  ListRow,
  Overline,
  ProgressBar,
  Row,
  Screen,
  ScreenHeader,
  SectionHeader,
  StarRating,
  StatTile,
  Text,
  TextButton,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { LEVEL_LABEL, plural } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ProfileSkeleton() {
  const t = useTheme();
  return (
    <Screen scroll>
      <Skeleton width="40%" height={28} style={{ marginBottom: t.spacing.lg }} />
      <Skeleton height={230} radius={t.radius.lg} style={{ marginBottom: t.spacing.lg }} />
      <Row gap={t.spacing.sm}>
        <Skeleton width="31%" height={108} radius={t.radius.lg} />
        <Skeleton width="31%" height={108} radius={t.radius.lg} />
        <Skeleton width="31%" height={108} radius={t.radius.lg} />
      </Row>
    </Screen>
  );
}

/** A titled card of navigation rows. */
function LinkGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: t.spacing.xl }}>
      <Overline style={{ marginBottom: t.spacing.sm, marginLeft: 4 }}>{title}</Overline>
      <Card style={{ padding: 0, overflow: 'hidden' }}>{children}</Card>
    </View>
  );
}

/** The signed-in student's own profile: the Profile tab. */
export function ProfileScreen() {
  const t = useTheme();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const state = useAsync(async () => usersApi.me(), []);

  useFocusEffect(
    useCallback(() => {
      state.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (state.loading) return <ProfileSkeleton />;

  const profile = state.data;

  // What makes a profile matchable, in the order worth doing. The first one missing is
  // offered as the next step, so the meter always comes with something to do about it.
  const checklist: Array<{ done: boolean; label: string; go(): void }> = [
    { done: (profile?.teaches.length ?? 0) > 0, label: 'Add a skill you can teach', go: () => navigation.navigate('MySkills') },
    { done: (profile?.learns.length ?? 0) > 0, label: 'Add a skill you want to learn', go: () => navigation.navigate('MySkills') },
    { done: Boolean(user?.bio), label: 'Write a short bio', go: () => navigation.navigate('EditProfile') },
    { done: Boolean(user?.college), label: 'Add your college', go: () => navigation.navigate('EditProfile') },
    {
      done: (profile?.availability.length ?? 0) > 0,
      label: 'Say when you are usually free',
      go: () => navigation.navigate('EditProfile'),
    },
    { done: Boolean(user?.emailVerified), label: 'Verify your email', go: () => navigation.navigate('Settings') },
  ];
  const done = checklist.filter((item) => item.done).length;
  const next = checklist.find((item) => !item.done);

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <ScreenHeader
        title="Profile"
        right={
          <>
            <IconButton icon="create-outline" accessibilityLabel="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
            <IconButton icon="settings-outline" accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} />
          </>
        }
      />

      {state.error ? <Banner tone="danger" text={state.error} /> : null}

      {/* Identity card: a strip of the brand gradient with the avatar sitting across its edge. */}
      <Card style={{ padding: 0, overflow: 'hidden' }} elevated={2}>
        <LinearGradient colors={t.gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 76 }} />
        <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -42 }}>
            <View style={{ borderRadius: 50, borderWidth: 4, borderColor: t.colors.surface }}>
              <Avatar name={user?.name ?? '?'} uri={user?.profileImage} size={84} />
            </View>
            <TextButton
              label="View as others see it"
              size={13.5}
              onPress={() => user && navigation.navigate('StudentProfile', { userId: user.id })}
              style={{ marginBottom: 4 }}
            />
          </Row>
          <Row gap={6} style={{ marginTop: t.spacing.md }}>
            <Text numberOfLines={1} style={[t.typography.title, { color: t.colors.text, flexShrink: 1 }]}>
              {user?.name}
            </Text>
            {user?.emailVerified ? (
              <Ionicons name="checkmark-circle" size={20} color={t.colors.primary} accessibilityLabel="Verified email" />
            ) : null}
          </Row>
          {user?.college ? (
            <Body small muted style={{ marginTop: 2 }}>
              {user.college}
              {user.department ? ` · ${user.department}` : ''}
              {user.year ? ` · Year ${user.year}` : ''}
            </Body>
          ) : null}
          <Row style={{ marginTop: t.spacing.sm }}>
            <StarRating value={profile?.rating.average ?? 0} count={profile?.rating.count ?? 0} />
          </Row>
          {user?.bio ? (
            <Body small style={{ marginTop: t.spacing.md }}>
              {user.bio}
            </Body>
          ) : null}
        </View>
      </Card>

      {next ? (
        <Card style={{ marginTop: t.spacing.lg }} tint={t.colors.primarySoft} elevated={0}>
          <Row style={{ justifyContent: 'space-between', marginBottom: t.spacing.sm }}>
            <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: t.colors.text }}>
              Profile {done} of {checklist.length} done
            </Text>
            <Caption style={{ color: t.colors.primary, fontWeight: '700' }}>
              {Math.round((done / checklist.length) * 100)}%
            </Caption>
          </Row>
          <ProgressBar value={done / checklist.length} height={8} />
          <Caption style={{ marginTop: t.spacing.md }}>Complete profiles get better matches. Next:</Caption>
          <TextButton label={`${next.label} →`} size={15} onPress={next.go} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ) : null}

      <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.lg, alignItems: 'stretch' }}>
        <StatTile index={0} label="Sessions taught" value={profile?.stats.sessionsTaught ?? 0} icon="school" tone="teach" />
        <StatTile index={1} label="Points" value={profile?.stats.points ?? 0} icon="trophy" tone="success" />
        <StatTile index={2} label="Day streak" value={profile?.stats.streakDays ?? 0} icon="flame" tone="warning" />
      </Row>

      <View style={{ marginTop: t.spacing.xl }}>
        <SectionHeader title="My skills" actionLabel="Manage" onAction={() => navigation.navigate('MySkills')} />
        <Card style={{ gap: t.spacing.md }}>
          <View style={{ gap: 7 }}>
            <Overline style={{ color: t.colors.primary }}>I teach</Overline>
            {(profile?.teaches.length ?? 0) > 0 ? (
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {(profile?.teaches ?? []).map((entry) => (
                  <Chip key={entry.id} label={`${entry.skill.name} · ${LEVEL_LABEL[entry.level]}`} tone="teach" />
                ))}
              </Row>
            ) : (
              <Caption>Nothing yet. What could you show someone?</Caption>
            )}
          </View>
          <Divider spacing={0} />
          <View style={{ gap: 7 }}>
            <Overline style={{ color: t.colors.learn }}>I want to learn</Overline>
            {(profile?.learns.length ?? 0) > 0 ? (
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {(profile?.learns ?? []).map((entry) => (
                  <Chip key={entry.id} label={`${entry.skill.name} · ${LEVEL_LABEL[entry.level]}`} tone="learn" />
                ))}
              </Row>
            ) : (
              <Caption>Nothing yet. What have you always wanted to try?</Caption>
            )}
          </View>
        </Card>
      </View>

      <LinkGroup title="Activity">
        <ListRow icon="calendar" tone="accent" title="My sessions" onPress={() => navigation.navigate('MySessions')} />
        <Divider spacing={0} />
        <ListRow icon="mail" tone="learn" title="Learning requests" onPress={() => navigation.navigate('LearningRequests')} />
        <Divider spacing={0} />
        <ListRow icon="people" tone="primary" title="Connections" onPress={() => navigation.navigate('Connections')} />
      </LinkGroup>

      <LinkGroup title="Progress">
        <ListRow icon="stats-chart" tone="accent" title="Learning analytics" onPress={() => navigation.navigate('Analytics')} />
        <Divider spacing={0} />
        <ListRow
          icon="ribbon"
          tone="learn"
          title="Achievements"
          value={plural(profile?.badges.length ?? 0, 'badge')}
          onPress={() => navigation.navigate('Badges')}
        />
        <Divider spacing={0} />
        <ListRow icon="trophy" tone="warning" title="Leaderboard" onPress={() => navigation.navigate('Leaderboard')} />
        <Divider spacing={0} />
        <ListRow
          icon="star"
          tone="warning"
          title="Reviews about me"
          value={String(profile?.rating.count ?? 0)}
          onPress={() => navigation.navigate('Reviews', { userId: user?.id ?? '', userName: user?.name ?? 'you' })}
        />
      </LinkGroup>

      <View style={{ height: t.spacing.xl }} />
    </Screen>
  );
}
