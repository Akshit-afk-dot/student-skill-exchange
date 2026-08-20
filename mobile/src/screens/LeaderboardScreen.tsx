import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { gamification } from '../api/endpoints';
import {
  Avatar,
  Banner,
  Body,
  Caption,
  Chip,
  EmptyState,
  Heading,
  LoadingView,
  Row,
  Screen,
  StarRating,
  Title,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';

/** Medal colours for the top three; everyone else gets a plain number. */
const MEDAL: Record<number, string> = { 1: '#D4AF37', 2: '#A8A9AD', 3: '#B08D57' };

export function LeaderboardScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const [scope, setScope] = useState<'global' | 'college'>('global');

  const state = useAsync(async () => gamification.leaderboard({ scope, page: 1 }), [scope]);

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Title>Leaderboard</Title>
        <Body muted style={{ marginTop: 4 }}>
          Points come from teaching, learning and keeping a streak.
        </Body>
        <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.md }}>
          <Chip label="Everyone" selected={scope === 'global'} onPress={() => setScope('global')} />
          <Chip
            label={user?.college ? 'My college' : 'My college (set one first)'}
            selected={scope === 'college'}
            onPress={() => setScope('college')}
          />
        </Row>
      </View>

      {state.loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={state.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: t.spacing.lg, paddingTop: t.spacing.sm }}
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          ListHeaderComponent={state.error ? <Banner tone="danger" text={state.error} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="podium-outline"
              title="Nobody ranked yet"
              message={
                scope === 'college'
                  ? 'Set your college on your profile, or switch to everyone.'
                  : 'Complete a session to get on the board.'
              }
            />
          }
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: t.colors.border, opacity: 0.5 }} />
          )}
          renderItem={({ item }) => {
            const isMe = item.id === user?.id;
            return (
              <Row
                gap={t.spacing.md}
                style={{
                  paddingVertical: t.spacing.md,
                  paddingHorizontal: isMe ? t.spacing.md : 0,
                  borderRadius: t.radius.md,
                  backgroundColor: isMe ? t.colors.primarySoft : 'transparent',
                }}
              >
                <View style={{ width: 28, alignItems: 'center' }}>
                  <Heading style={{ color: MEDAL[item.rank] ?? t.colors.textMuted }}>
                    {item.rank}
                  </Heading>
                </View>

                <Avatar name={item.name} uri={item.profileImage} size={40} />

                <View style={{ flex: 1 }}>
                  <Heading numberOfLines={1}>
                    {item.name}
                    {isMe ? ' (you)' : ''}
                  </Heading>
                  <Row gap={t.spacing.md} style={{ marginTop: 2 }}>
                    {item.college ? <Caption numberOfLines={1}>{item.college}</Caption> : null}
                    <StarRating value={item.rating} showValue />
                  </Row>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Heading>{item.points}</Heading>
                  <Caption>{item.sessionsTaught} taught</Caption>
                </View>
              </Row>
            );
          }}
        />
      )}
    </Screen>
  );
}
