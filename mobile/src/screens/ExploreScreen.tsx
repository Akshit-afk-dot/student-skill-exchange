import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { skills as skillsApi, users as usersApi } from '../api/endpoints';
import { FadeInView, PressableScale, Skeleton } from '../components/motion';
import {
  Banner,
  Caption,
  Card,
  Chip,
  IconTile,
  Input,
  Row,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
  type Tone,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { plural } from '../utils/format';
import type { SkillCategory } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Each seeded category gets its own icon. They all share the brand tint: the picture tells
 * them apart, and a rainbow of colours would compete with the ones that carry meaning.
 */
const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Programming: 'code-slash',
  Design: 'color-palette',
  Academics: 'school',
  Languages: 'language',
  Communication: 'mic',
  Business: 'briefcase',
  Music: 'musical-notes',
  Photography: 'camera',
  Sports: 'basketball',
};

function lookFor(name: string): { icon: keyof typeof Ionicons.glyphMap; tone: Tone } {
  return { icon: CATEGORY_ICON[name] ?? 'apps', tone: 'primary' };
}

function CategoryTile({
  category,
  selected,
  onPress,
}: {
  category: SkillCategory;
  selected: boolean;
  onPress(): void;
}) {
  const t = useTheme();
  const look = lookFor(category.name);
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.95}
      accessibilityLabel={category.name}
      accessibilityState={{ selected }}
      style={{ width: '31.5%' }}
    >
      <View
        style={{
          alignItems: 'center',
          gap: 8,
          paddingVertical: t.spacing.md,
          borderRadius: t.radius.lg,
          // Selected: the secondary container and a brand border, plus the bolder label,
          // so the state shows by weight and outline, not by tint alone.
          backgroundColor: selected ? t.colors.secondaryContainer : t.colors.surface,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? t.colors.primary : t.colors.border,
        }}
      >
        <IconTile icon={look.icon} tone={look.tone} size={44} />
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13,
            lineHeight: 17,
            fontWeight: selected ? '700' : '600',
            color: selected ? t.colors.onSecondaryContainer : t.colors.textPrimary,
          }}
        >
          {category.name}
        </Text>
      </View>
    </PressableScale>
  );
}

/** The skills inside the chosen category. Tapping one finds the students who teach it. */
function CategorySkills({ category, onPick }: { category: SkillCategory; onPick(id: string, name: string): void }) {
  const t = useTheme();
  const state = useAsync(async () => skillsApi.search({ category: category.id, limit: 30 }), [category.id]);
  return (
    <FadeInView>
      <Card style={{ marginTop: t.spacing.md }}>
        <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: t.colors.textPrimary, marginBottom: t.spacing.md }}>
          {category.name} skills
        </Text>
        {state.loading ? (
          <Row gap={t.spacing.sm}>
            <Skeleton width={90} height={38} radius={19} />
            <Skeleton width={120} height={38} radius={19} />
            <Skeleton width={80} height={38} radius={19} />
          </Row>
        ) : (state.data?.items ?? []).length === 0 ? (
          <Caption>No skills listed here yet.</Caption>
        ) : (
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
            {(state.data?.items ?? []).map((skill) => (
              <Chip
                key={skill.id}
                label={skill.teachCount > 0 ? `${skill.name} · ${skill.teachCount}` : skill.name}
                onPress={() => onPick(skill.id, skill.name)}
              />
            ))}
          </Row>
        )}
      </Card>
    </FadeInView>
  );
}

function ExploreSkeleton() {
  const t = useTheme();
  return (
    <Screen scroll>
      <Skeleton width="45%" height={28} style={{ marginBottom: 8 }} />
      <Skeleton width="70%" height={14} style={{ marginBottom: t.spacing.lg }} />
      <Skeleton height={50} radius={25} style={{ marginBottom: t.spacing.xl }} />
      <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} width="31%" height={96} radius={t.radius.lg} />
        ))}
      </Row>
    </Screen>
  );
}

export function ExploreScreen() {
  const t = useTheme();
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SkillCategory | null>(null);

  const load = useCallback(async () => Promise.all([skillsApi.categories(), skillsApi.popular(), usersApi.facets()]), []);
  const state = useAsync(load, []);

  function search() {
    const q = query.trim();
    if (!q) return;
    navigation.navigate('SearchResults', { q });
  }

  const openSkill = (skillId: string, skillName: string) => navigation.navigate('SearchResults', { skillId, skillName });

  if (state.loading) return <ExploreSkeleton />;

  const [categories, popular, facets] = state.data ?? [];

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <ScreenHeader title="Explore" subtitle="Find a student who teaches what you want to learn." />

      {state.error ? <Banner tone="danger" text={state.error} /> : null}

      <Input
        icon="search"
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or college"
        returnKeyType="search"
        onSubmitEditing={search}
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={{ borderRadius: 25, marginBottom: t.spacing.xl }}
      />

      <SectionHeader title="Browse by category" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: t.spacing.sm }}>
        {(categories ?? []).map((c) => (
          <CategoryTile
            key={c.id}
            category={c}
            selected={category?.id === c.id}
            onPress={() => setCategory(category?.id === c.id ? null : c)}
          />
        ))}
      </View>
      {category ? <CategorySkills key={category.id} category={category} onPick={openSkill} /> : null}

      <View style={{ marginTop: t.spacing.xl }}>
        <SectionHeader title="Most taught" />
        {(popular?.mostTaught ?? []).length === 0 ? (
          <Caption>No one has listed a teaching skill yet. Be the first.</Caption>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -t.spacing.page }}
            contentContainerStyle={{ paddingHorizontal: t.spacing.page, gap: t.spacing.md, paddingBottom: t.spacing.sm }}
          >
            {(popular?.mostTaught ?? []).map((skill, i) => {
              const look = lookFor(skill.category?.name ?? '');
              return (
                <Card
                  key={skill.id}
                  onPress={() => openSkill(skill.id, skill.name)}
                  accessibilityLabel={`${skill.name}, ${plural(skill.teachCount, 'teacher')}`}
                  style={{ width: 156, gap: t.spacing.md }}
                >
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <IconTile icon={look.icon} tone={look.tone} size={40} />
                    <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '800', color: t.colors.textSecondary }}>
                      #{i + 1}
                    </Text>
                  </Row>
                  <View>
                    <Text numberOfLines={2} style={{ fontSize: 15.5, lineHeight: 21, fontWeight: '700', color: t.colors.textPrimary }}>
                      {skill.name}
                    </Text>
                    <Caption style={{ marginTop: 2 }}>{plural(skill.teachCount, 'teacher')}</Caption>
                  </View>
                </Card>
              );
            })}
          </ScrollView>
        )}
      </View>

      {(popular?.mostWanted ?? []).length > 0 ? (
        <View style={{ marginTop: t.spacing.xl }}>
          <SectionHeader title="Most wanted" />
          <Caption style={{ marginTop: -t.spacing.sm, marginBottom: t.spacing.md }}>
            Students are looking for these. If you know one, you are in demand.
          </Caption>
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
            {(popular?.mostWanted ?? []).map((skill) => (
              <Chip
                key={skill.id}
                label={`${skill.name} · ${skill.learnCount}`}
                tone="learn"
                icon="trending-up"
                onPress={() => openSkill(skill.id, skill.name)}
              />
            ))}
          </Row>
        </View>
      ) : null}

      {(facets?.colleges ?? []).length > 0 ? (
        <View style={{ marginTop: t.spacing.xl, marginBottom: t.spacing.lg }}>
          <SectionHeader title="Colleges" />
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
            {(facets?.colleges ?? []).slice(0, 12).map((college) => (
              <Chip
                key={college.value}
                label={`${college.value} · ${college.count}`}
                icon="school-outline"
                onPress={() => navigation.navigate('SearchResults', { q: college.value })}
              />
            ))}
          </Row>
        </View>
      ) : null}
    </Screen>
  );
}
