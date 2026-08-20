import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { matching } from '../api/endpoints';
import { MatchCard } from '../components/cards';
import {
  Banner,
  Body,
  Card,
  Chip,
  EmptyState,
  LoadingView,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { plural } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

/**
 * Ranked learning partners.
 *
 * The "how this works" card is deliberate: a score with no explanation reads as
 * arbitrary, and the weighting is the interesting part of the system.
 */
export function MatchesScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [twoWayOnly, setTwoWayOnly] = useState(false);
  const [showHow, setShowHow] = useState(false);

  const load = useCallback(
    async () => matching.recommendations({ limit: 25, ...(twoWayOnly ? { twoWayOnly: true } : {}) }),
    [twoWayOnly],
  );
  const state = useAsync(load, [twoWayOnly]);

  const weights = useAsync(async () => matching.weights(), []);

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Title>Your matches</Title>
        <Body muted style={{ marginTop: 4 }}>
          Ranked by how well your skills fit together.
        </Body>

        <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.md, flexWrap: 'wrap' }}>
          <Chip
            label="All matches"
            selected={!twoWayOnly}
            onPress={() => setTwoWayOnly(false)}
          />
          <Chip
            label="Two-way only"
            icon="swap-horizontal"
            selected={twoWayOnly}
            onPress={() => setTwoWayOnly(true)}
          />
          <Chip
            label="How scoring works"
            icon="information-circle-outline"
            onPress={() => setShowHow((v) => !v)}
          />
        </Row>

        {showHow && weights.data ? (
          <Card style={{ marginTop: t.spacing.md }}>
            <Body small>
              Every candidate is scored out of 100 from five signals, then reciprocal
              exchanges get a bonus:
            </Body>
            <View style={{ marginTop: t.spacing.sm, gap: 4 }}>
              {[
                ['Skill fit', weights.data.skill],
                ['Shared free time', weights.data.availability],
                ['Experience level', weights.data.experience],
                ['Rating', weights.data.rating],
                ['Location', weights.data.location],
              ].map(([label, value]) => (
                <Row key={String(label)} style={{ justifyContent: 'space-between' }}>
                  <Body small muted>
                    {label}
                  </Body>
                  <Body small>{Math.round(Number(value) * 100)}%</Body>
                </Row>
              ))}
            </View>
          </Card>
        ) : null}

        {state.data ? (
          <Body small muted style={{ marginTop: t.spacing.md }}>
            {plural(state.data.total, 'match', 'matches')}
          </Body>
        ) : null}
      </View>

      {state.loading ? (
        <LoadingView label="Scoring your matches…" />
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
              icon="git-compare-outline"
              title={twoWayOnly ? 'No two-way exchanges yet' : 'No matches yet'}
              message={
                twoWayOnly
                  ? 'Nobody currently wants to learn what you teach and teaches what you want. Try viewing all matches.'
                  : 'Add more skills to your profile, or browse students directly from Explore.'
              }
              actionLabel={twoWayOnly ? 'Show all matches' : 'Manage my skills'}
              onAction={() =>
                twoWayOnly ? setTwoWayOnly(false) : navigation.navigate('MySkills')
              }
            />
          }
          renderItem={({ item }) => (
            <MatchCard
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
