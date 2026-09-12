import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { users as usersApi } from '../api/endpoints';
import { StudentCard } from '../components/cards';
import {
  Banner,
  Body,
  Chip,
  EmptyState,
  Input,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { SkeletonList } from '../components/motion';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { LEVEL_LABEL, plural } from '../utils/format';
import { SKILL_LEVELS, type SkillLevel } from '../types';
import type { RootStackParamList } from '../navigation/types';

type SortOption = 'relevance' | 'rating' | 'sessions';

const SORTS: Array<{ value: SortOption; label: string }> = [
  { value: 'relevance', label: 'Best match' },
  { value: 'rating', label: 'Top rated' },
  { value: 'sessions', label: 'Most active' },
];

export function SearchResultsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SearchResults'>>();
  const { skillId, skillName } = route.params ?? {};

  const [query, setQuery] = useState(route.params?.q ?? '');
  // Applied separately from `query` so the list refetches on submit, not on each keystroke.
  const [applied, setApplied] = useState(route.params?.q ?? '');
  const [level, setLevel] = useState<SkillLevel | null>(null);
  const [sort, setSort] = useState<SortOption>('relevance');
  const [onlineOnly, setOnlineOnly] = useState(false);

  const load = useCallback(
    async () =>
      usersApi.search({
        ...(applied ? { q: applied } : {}),
        ...(skillId ? { skill: skillId } : {}),
        ...(level ? { level } : {}),
        ...(onlineOnly ? { onlineNow: true } : {}),
        sort,
        limit: 30,
      }),
    [applied, skillId, level, sort, onlineOnly],
  );

  const state = useAsync(load, [applied, skillId, level, sort, onlineOnly]);

  return (
    <Screen padded={false} edges={[]}>
      <View style={{ padding: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Title>{skillName ? `Teaches ${skillName}` : 'Search'}</Title>

        {!skillId ? (
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Name or college"
            returnKeyType="search"
            onSubmitEditing={() => setApplied(query.trim())}
            autoCapitalize="none"
            style={{ marginTop: t.spacing.md }}
          />
        ) : null}

        <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.md, flexWrap: 'wrap' }}>
          {SORTS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={sort === option.value}
              onPress={() => setSort(option.value)}
            />
          ))}
          <Chip
            label="Online now"
            icon="ellipse"
            selected={onlineOnly}
            onPress={() => setOnlineOnly((v) => !v)}
          />
        </Row>

        {skillId ? (
          <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.sm, flexWrap: 'wrap' }}>
            <Chip label="Any level" selected={level === null} onPress={() => setLevel(null)} />
            {SKILL_LEVELS.map((l) => (
              <Chip
                key={l}
                label={LEVEL_LABEL[l]}
                selected={level === l}
                onPress={() => setLevel(level === l ? null : l)}
              />
            ))}
          </Row>
        ) : null}

        {state.data ? (
          <Body small muted style={{ marginTop: t.spacing.md }}>
            {plural(state.data.total, 'student')} found
          </Body>
        ) : null}
      </View>

      {state.loading ? (
        <View style={{ paddingHorizontal: t.spacing.lg }}>
          <SkeletonList count={4} lines={1} />
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
              icon="search-outline"
              title="No students found"
              message={
                skillName
                  ? `Nobody is teaching ${skillName} yet. Try a different skill, or widen your filters.`
                  : 'Try a different search term or clear the filters.'
              }
            />
          }
          renderItem={({ item, index }) => (
            <StudentCard
              index={index}
              student={item}
              onPress={() => navigation.navigate('StudentProfile', { userId: item.id })}
            />
          )}
        />
      )}
    </Screen>
  );
}
