import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { matching } from '../api/endpoints';
import { MatchCard } from '../components/cards';
import { Animated, FadeInDown, LAYOUT_ANIMATIONS_SUPPORTED, SkeletonList } from '../components/motion';
import {
  Banner,
  Body,
  Caption,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  Row,
  Screen,
  ScreenHeader,
  Segmented,
  Text,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { plural } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

type Filter = 'all' | 'twoWay';

/** The scoring weights as bars, so "40% skill fit" is something you can see, not just read. */
function HowScoringWorks({ weights }: { weights: Record<string, number> }) {
  const t = useTheme();
  const rows: Array<[string, number, string]> = [
    ['Skill fit', weights.skill ?? 0, t.colors.primary],
    ['Shared free time', weights.availability ?? 0, t.colors.accent],
    ['Experience level', weights.experience ?? 0, t.colors.learnVivid],
    ['Rating', weights.rating ?? 0, t.colors.star],
    ['Location', weights.location ?? 0, t.colors.success],
  ];
  const spring = t.motion.springs.spatial;

  return (
    <Animated.View
      entering={
        LAYOUT_ANIMATIONS_SUPPORTED
          ? FadeInDown.springify().damping(spring.damping).stiffness(spring.stiffness)
          : undefined
      }
    >
      <Card style={{ marginTop: t.spacing.md }} tint={t.colors.surface}>
        <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '700', color: t.colors.text }}>
          How your score is built
        </Text>
        <Body small muted style={{ marginTop: 2, marginBottom: t.spacing.md }}>
          Five signals, weighted and added up to 100. Two-way exchanges get a bonus on top.
        </Body>
        <View style={{ gap: 10 }}>
          {rows.map(([label, value, colour]) => (
            <View key={label} style={{ gap: 5 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Caption style={{ color: t.colors.text, fontSize: 13 }}>{label}</Caption>
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 17,
                    fontWeight: '700',
                    color: t.colors.text,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {Math.round(value * 100)}%
                </Text>
              </Row>
              {/* Scaled so the largest weight fills about half the bar: proportion is the point. */}
              <ProgressBar value={value * 2} color={colour} height={6} />
            </View>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}

/**
 * Ranked learning partners.
 *
 * The scoring explainer is one tap away on purpose: a score with no explanation reads as
 * arbitrary, and the weighting is the interesting part of the system.
 */
export function MatchesScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [filter, setFilter] = useState<Filter>('all');
  const [showHow, setShowHow] = useState(false);
  const twoWayOnly = filter === 'twoWay';

  const load = useCallback(
    async () => matching.recommendations({ limit: 25, ...(twoWayOnly ? { twoWayOnly: true } : {}) }),
    [twoWayOnly],
  );
  const state = useAsync(load, [twoWayOnly]);
  const weights = useAsync(async () => matching.weights(), []);

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ paddingHorizontal: t.spacing.page, paddingTop: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <ScreenHeader
          title="Matches"
          subtitle="Ranked by how well your skills fit together."
          right={
            <IconButton
              icon={showHow ? 'close' : 'help'}
              tone={showHow ? 'primary' : 'surface'}
              accessibilityLabel={showHow ? 'Hide how scoring works' : 'How scoring works'}
              onPress={() => setShowHow((v) => !v)}
            />
          }
        />

        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All matches', icon: 'people' },
            { value: 'twoWay', label: 'Two-way', icon: 'swap-horizontal' },
          ]}
        />

        {showHow && weights.data ? <HowScoringWorks weights={weights.data} /> : null}

        {state.data && state.data.total > 0 ? (
          <Caption style={{ marginTop: t.spacing.md }}>
            {plural(state.data.total, 'match', 'matches')}, best first
          </Caption>
        ) : null}
      </View>

      {state.loading ? (
        <View style={{ paddingHorizontal: t.spacing.page, paddingTop: t.spacing.sm }}>
          <SkeletonList count={3} lines={3} />
        </View>
      ) : (
        <FlatList
          data={state.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: t.spacing.page,
            paddingTop: t.spacing.sm,
            paddingBottom: t.spacing.xxl,
          }}
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={state.error ? <Banner tone="danger" text={state.error} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon={twoWayOnly ? 'swap-horizontal' : 'people'}
              tone={twoWayOnly ? 'success' : 'primary'}
              title={twoWayOnly ? 'No two-way exchanges yet' : 'No matches yet'}
              message={
                twoWayOnly
                  ? 'Nobody wants to learn what you teach while teaching what you want, yet. All matches may still have someone great.'
                  : 'Add more skills to your profile, or browse students directly from Explore.'
              }
              actionLabel={twoWayOnly ? 'Show all matches' : 'Manage my skills'}
              onAction={() => (twoWayOnly ? setFilter('all') : navigation.navigate('MySkills'))}
            />
          }
          renderItem={({ item, index }) => (
            <MatchCard
              index={index}
              match={item}
              onPress={() => navigation.navigate('StudentProfile', { userId: item.id })}
              onRequest={() =>
                navigation.navigate('SendRequest', {
                  userId: item.id,
                  userName: item.name,
                  ...(item.theyTeachYouWant[0] ? { skillId: item.theyTeachYouWant[0].id } : {}),
                })
              }
            />
          )}
        />
      )}
    </Screen>
  );
}
