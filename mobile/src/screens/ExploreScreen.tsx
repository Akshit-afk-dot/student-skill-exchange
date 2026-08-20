import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { skills as skillsApi, users as usersApi } from '../api/endpoints';
import {
  Banner,
  Body,
  Caption,
  Card,
  Chip,
  Heading,
  Input,
  LoadingView,
  Row,
  Screen,
  SectionHeader,
  Title,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { plural } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

export function ExploreScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');

  const load = useCallback(
    async () =>
      Promise.all([skillsApi.categories(), skillsApi.popular(), usersApi.facets()]),
    [],
  );
  const state = useAsync(load, []);

  function search() {
    const q = query.trim();
    if (!q) return;
    navigation.navigate('SearchResults', { q });
  }

  if (state.loading) return <LoadingView />;

  const [categories, popular, facets] = state.data ?? [];

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Title>Explore</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        Find a student who teaches what you want to learn.
      </Body>

      {state.error ? <Banner tone="danger" text={state.error} /> : null}

      <View style={{ marginBottom: t.spacing.xl }}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search students by name or college"
          returnKeyType="search"
          onSubmitEditing={search}
          autoCapitalize="none"
        />
      </View>

      <SectionHeader title="Browse by category" />
      <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap', marginBottom: t.spacing.xl }}>
        {(categories ?? []).map((category) => (
          <Pressable
            key={category.id}
            onPress={() => navigation.navigate('SearchResults', { q: '' })}
            accessibilityRole="button"
            style={{
              backgroundColor: t.colors.surface,
              borderWidth: 1,
              borderColor: t.colors.border,
              borderRadius: t.radius.md,
              paddingHorizontal: t.spacing.md,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="pricetag-outline" size={14} color={t.colors.primary} />
            <Body small>{category.name}</Body>
          </Pressable>
        ))}
      </Row>

      <SectionHeader title="Most taught skills" />
      {(popular?.mostTaught ?? []).length === 0 ? (
        <Card style={{ marginBottom: t.spacing.xl }}>
          <Body muted>No one has listed a teaching skill yet. Be the first.</Body>
        </Card>
      ) : (
        <FlatList
          data={popular?.mostTaught ?? []}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: t.spacing.sm, paddingBottom: t.spacing.xl }}
          renderItem={({ item }) => (
            <Card
              onPress={() =>
                navigation.navigate('SearchResults', { skillId: item.id, skillName: item.name })
              }
              style={{ width: 168 }}
            >
              <Heading numberOfLines={2}>{item.name}</Heading>
              <Caption style={{ marginTop: 6 }}>
                {plural(item.teachCount, 'teacher')}
              </Caption>
              {item.category ? (
                <Row style={{ marginTop: t.spacing.sm }}>
                  <Chip label={item.category.name} />
                </Row>
              ) : null}
            </Card>
          )}
        />
      )}

      <SectionHeader title="Most wanted skills" />
      <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap', marginBottom: t.spacing.xl }}>
        {(popular?.mostWanted ?? []).map((skill) => (
          <Chip
            key={skill.id}
            label={`${skill.name} · ${skill.learnCount}`}
            tone="warning"
            onPress={() =>
              navigation.navigate('SearchResults', { skillId: skill.id, skillName: skill.name })
            }
          />
        ))}
      </Row>

      {(facets?.colleges ?? []).length > 0 ? (
        <>
          <SectionHeader title="Colleges on the platform" />
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
            {(facets?.colleges ?? []).slice(0, 12).map((college) => (
              <Chip
                key={college.value}
                label={`${college.value} · ${college.count}`}
                onPress={() => navigation.navigate('SearchResults', { q: college.value })}
              />
            ))}
          </Row>
        </>
      ) : null}
    </Screen>
  );
}
