import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { users as usersApi } from '../api/endpoints';
import {
  Avatar,
  Banner,
  Body,
  Caption,
  Card,
  Chip,
  Divider,
  LoadingView,
  Row,
  Screen,
  SectionHeader,
  StarRating,
  StatTile,
  Title,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { LEVEL_LABEL, plural } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

/** The signed-in student's own profile: the Account tab. */
export function ProfileScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const state = useAsync(async () => usersApi.me(), []);

  useFocusEffect(
    useCallback(() => {
      state.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (state.loading) return <LoadingView />;

  const profile = state.data;

  const links: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    hint?: string;
    go(): void;
  }> = [
    {
      icon: 'construct-outline',
      label: 'My skills',
      hint: `${profile?.teaches.length ?? 0} teaching · ${profile?.learns.length ?? 0} learning`,
      go: () => navigation.navigate('MySkills'),
    },
    {
      icon: 'stats-chart-outline',
      label: 'Learning analytics',
      go: () => navigation.navigate('Analytics'),
    },
    {
      icon: 'trophy-outline',
      label: 'Achievements',
      hint: plural(profile?.badges.length ?? 0, 'badge'),
      go: () => navigation.navigate('Badges'),
    },
    {
      icon: 'podium-outline',
      label: 'Leaderboard',
      go: () => navigation.navigate('Leaderboard'),
    },
    {
      icon: 'calendar-outline',
      label: 'My sessions',
      go: () => navigation.navigate('MySessions'),
    },
    {
      icon: 'people-outline',
      label: 'Connections',
      go: () => navigation.navigate('Connections'),
    },
    {
      icon: 'star-outline',
      label: 'Reviews about me',
      hint: plural(profile?.rating.count ?? 0, 'review'),
      go: () =>
        navigation.navigate('Reviews', {
          userId: user?.id ?? '',
          userName: user?.name ?? 'you',
        }),
    },
    {
      icon: 'settings-outline',
      label: 'Settings',
      go: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Row style={{ justifyContent: 'space-between', marginBottom: t.spacing.lg }}>
        <Title>Profile</Title>
        <Pressable
          onPress={() => navigation.navigate('EditProfile')}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          hitSlop={8}
        >
          <Body style={{ color: t.colors.primary, fontWeight: '600' }}>Edit</Body>
        </Pressable>
      </Row>

      {state.error ? <Banner tone="danger" text={state.error} /> : null}

      {user && !user.emailVerified ? (
        <Banner tone="warning" text="Your email is not verified yet. Check your inbox." />
      ) : null}

      <Card>
        <Row gap={t.spacing.lg} style={{ alignItems: 'flex-start' }}>
          <Avatar name={user?.name ?? '?'} uri={user?.profileImage} size={66} />
          <View style={{ flex: 1 }}>
            <Title numberOfLines={2}>{user?.name}</Title>
            <Caption numberOfLines={1}>{user?.email}</Caption>
            {user?.college ? (
              <Body small muted style={{ marginTop: 4 }}>
                {user.college}
                {user.department ? ` · ${user.department}` : ''}
                {user.year ? ` · Year ${user.year}` : ''}
              </Body>
            ) : null}
            <Row style={{ marginTop: t.spacing.sm }}>
              <StarRating
                value={profile?.rating.average ?? 0}
                count={profile?.rating.count ?? 0}
              />
            </Row>
          </View>
        </Row>

        {user?.bio ? (
          <>
            <Divider />
            <Body small>{user.bio}</Body>
          </>
        ) : (
          <>
            <Divider />
            <Pressable onPress={() => navigation.navigate('EditProfile')}>
              <Body small muted>
                Add a short bio so other students know what you are about.
              </Body>
            </Pressable>
          </>
        )}
      </Card>

      <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.lg }}>
        <StatTile
          label="Sessions taught"
          value={profile?.stats.sessionsTaught ?? 0}
          icon="school-outline"
        />
        <StatTile
          label="Points"
          value={profile?.stats.points ?? 0}
          icon="trophy-outline"
          tone="success"
        />
        <StatTile
          label="Day streak"
          value={profile?.stats.streakDays ?? 0}
          icon="flame-outline"
          tone="warning"
        />
      </Row>

      {(profile?.teaches.length ?? 0) > 0 ? (
        <View style={{ marginTop: t.spacing.xl }}>
          <SectionHeader title="I teach" actionLabel="Manage" onAction={() => navigation.navigate('MySkills')} />
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
            {(profile?.teaches ?? []).map((entry) => (
              <Chip
                key={entry.id}
                label={`${entry.skill.name} · ${LEVEL_LABEL[entry.level]}`}
                tone="primary"
              />
            ))}
          </Row>
        </View>
      ) : null}

      {(profile?.learns.length ?? 0) > 0 ? (
        <View style={{ marginTop: t.spacing.lg }}>
          <SectionHeader title="I want to learn" />
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
            {(profile?.learns ?? []).map((entry) => (
              <Chip
                key={entry.id}
                label={`${entry.skill.name} · ${LEVEL_LABEL[entry.level]}`}
                tone="warning"
              />
            ))}
          </Row>
        </View>
      ) : null}

      <View style={{ marginTop: t.spacing.xl }}>
        {links.map((link, index) => (
          <View key={link.label}>
            <Pressable
              onPress={link.go}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.md,
                paddingVertical: t.spacing.md,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Ionicons name={link.icon} size={20} color={t.colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Body>{link.label}</Body>
                {link.hint ? <Caption>{link.hint}</Caption> : null}
              </View>
              <Ionicons name="chevron-forward" size={17} color={t.colors.textMuted} />
            </Pressable>
            {index < links.length - 1 ? (
              <View style={{ height: 1, backgroundColor: t.colors.border, opacity: 0.5 }} />
            ) : null}
          </View>
        ))}
      </View>

      <View style={{ height: t.spacing.xl }} />
    </Screen>
  );
}
