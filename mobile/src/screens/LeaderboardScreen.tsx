import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { gamification } from '../api/endpoints';
import { PressableScale, SkeletonRows } from '../components/motion';
import {
  Avatar,
  Banner,
  Body,
  Caption,
  Chip,
  EmptyState,
  Row,
  Screen,
  StarRating,
  Text,
} from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';


/** Width of the rank column. Fixed, so names line up whatever the rank's digit count. */
const RANK_WIDTH = 36;

export function LeaderboardScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [scope, setScope] = useState<'global' | 'college'>('global');

  const state = useAsync(async () => gamification.leaderboard({ scope, page: 1 }), [scope]);

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Body muted>
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
        <View style={{ paddingHorizontal: t.spacing.page }}>
          <SkeletonRows count={7} />
        </View>
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
            const medal: Record<number, string> = {
              1: t.colors.medalGold,
              2: t.colors.medalSilver,
              3: t.colors.medalBronze,
            };
            const onMedal = medal[item.rank] !== undefined;
            return (
              <PressableScale
                onPress={() => navigation.navigate('StudentProfile', { userId: item.id })}
                scaleTo={0.98}
                accessibilityLabel={`Rank ${item.rank}, ${item.name}${isMe ? ', you' : ''}, ${item.points} points`}
                accessibilityHint="Opens their profile"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.md,
                  paddingVertical: t.spacing.md,
                  paddingHorizontal: t.spacing.md,
                  marginHorizontal: -t.spacing.md,
                  borderRadius: t.radius.md,
                  backgroundColor: isMe ? t.colors.primaryContainer : 'transparent',
                }}
              >
                {/* Rank. The top three sit on a medal; the number always stays, so the
                    order never depends on telling gold, silver and bronze apart. */}
                <View style={{ width: RANK_WIDTH, alignItems: 'center', flexShrink: 0 }}>
                  <View
                    style={{
                      minWidth: 32,
                      height: 32,
                      paddingHorizontal: 4,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: medal[item.rank] ?? 'transparent',
                      // The outline is what makes a pale medal visible on a light page.
                      borderWidth: onMedal ? 1.5 : 0,
                      borderColor: t.colors.outline,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                      style={{
                        fontSize: item.rank >= 100 ? 13 : 16,
                        lineHeight: 20,
                        fontWeight: '800',
                        fontVariant: ['tabular-nums'],
                        color: onMedal ? t.colors.onMedal : t.colors.textSecondary,
                      }}
                    >
                      {item.rank}
                    </Text>
                  </View>
                </View>

                <Avatar name={item.name} uri={item.profileImage} size={40} />

                {/* The only column that gives way: long names and colleges truncate here
                    instead of running under the points. */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Row gap={6}>
                    <Text
                      numberOfLines={1}
                      style={{ flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '700', color: t.colors.textPrimary }}
                    >
                      {item.name}
                    </Text>
                    {/* A tag rather than "(you)" in the name, so truncation never eats it. */}
                    {isMe ? <Chip label="You" tone="primary" /> : null}
                  </Row>
                  <Row gap={t.spacing.sm} style={{ marginTop: 2 }}>
                    {item.college ? (
                      <Caption numberOfLines={1} style={{ flexShrink: 1 }}>
                        {item.college}
                      </Caption>
                    ) : null}
                    {item.rating > 0 ? (
                      <View style={{ flexShrink: 0 }}>
                        <StarRating value={item.rating} size={12} />
                      </View>
                    ) : null}
                  </Row>
                </View>

                <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 17,
                      lineHeight: 22,
                      fontWeight: '800',
                      fontVariant: ['tabular-nums'],
                      color: t.colors.textPrimary,
                    }}
                  >
                    {item.points}
                  </Text>
                  <Caption numberOfLines={1}>{item.sessionsTaught} taught</Caption>
                </View>

                <Ionicons name="chevron-forward" size={16} color={t.colors.textSecondary} />
              </PressableScale>
            );
          }}
        />
      )}
    </Screen>
  );
}
