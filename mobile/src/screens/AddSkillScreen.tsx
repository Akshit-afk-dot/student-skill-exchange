import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { skills as skillsApi } from '../api/endpoints';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Field,
  Input,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { useAction, useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { LEVEL_LABEL } from '../utils/format';
import { SKILL_LEVELS, type Skill, type SkillLevel } from '../types';
import type { RootStackParamList } from '../navigation/types';

const PRIORITIES = [
  { value: 1, label: 'Nice to have' },
  { value: 2, label: 'Important' },
  { value: 3, label: 'Top priority' },
];

export function AddSkillScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { type } = useRoute<RouteProp<RootStackParamList, 'AddSkill'>>().params;
  const isTeaching = type === 'TEACH';

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<Skill | null>(null);
  const [level, setLevel] = useState<SkillLevel>(isTeaching ? 'INTERMEDIATE' : 'BEGINNER');
  const [priority, setPriority] = useState(2);
  const [years, setYears] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useAsync(
    async () => (debounced.length >= 2 ? skillsApi.search({ q: debounced, limit: 12 }) : null),
    [debounced],
  );
  const categories = useAsync(async () => skillsApi.categories(), []);

  const exactMatch = (results.data?.items ?? []).some(
    (s) => s.name.toLowerCase() === debounced.toLowerCase(),
  );
  const canPropose = debounced.length >= 2 && !exactMatch && !selected;

  const submit = useAction(async () => {
    await skillsApi.add({
      ...(selected ? { skillId: selected.id } : { skillName: debounced, categoryId: categoryId ?? undefined }),
      type,
      level,
      ...(isTeaching && years ? { yearsOfExperience: Number(years) } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(!isTeaching ? { priority } : {}),
    });
    navigation.goBack();
  });

  const readyToSubmit = Boolean(selected) || (canPropose && categoryId);

  return (
    <Screen scroll>
      <Title>{isTeaching ? 'Add a teaching skill' : 'Add a learning goal'}</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        {isTeaching
          ? 'What can you help another student with?'
          : 'What do you want someone to teach you?'}
      </Body>

      {submit.error ? <Banner tone="danger" text={submit.error} /> : null}

      <Field label="Skill">
        {selected ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Body>{selected.name}</Body>
                {selected.category ? <Caption>{selected.category.name}</Caption> : null}
              </View>
              <Chip
                label="Change"
                onPress={() => {
                  setSelected(null);
                  setQuery('');
                }}
              />
            </Row>
          </Card>
        ) : (
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Start typing, e.g. Python"
            autoCapitalize="words"
            autoFocus
          />
        )}
      </Field>

      {!selected && (results.data?.items ?? []).length > 0 ? (
        <View style={{ marginBottom: t.spacing.lg }}>
          {(results.data?.items ?? []).map((skill) => (
            <Pressable
              key={skill.id}
              onPress={() => setSelected(skill)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                paddingVertical: 11,
                paddingHorizontal: t.spacing.md,
                borderRadius: t.radius.sm,
                backgroundColor: pressed ? t.colors.surfaceAlt : 'transparent',
              })}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Body>{skill.name}</Body>
                {skill.category ? <Caption>{skill.category.name}</Caption> : null}
              </Row>
            </Pressable>
          ))}
        </View>
      ) : null}

      {canPropose ? (
        <Card style={{ marginBottom: t.spacing.lg }}>
          <Body small>
            No skill called “{debounced}” yet. Pick a category and we will add it.
          </Body>
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap', marginTop: t.spacing.md }}>
            {(categories.data ?? []).map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                selected={categoryId === category.id}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </Row>
        </Card>
      ) : null}

      <Field
        label={isTeaching ? 'Your level' : 'Level you want to reach'}
        hint={
          isTeaching
            ? 'Be honest — matching works better when levels are accurate.'
            : 'We look for teachers a level or two above this.'
        }
      >
        <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
          {SKILL_LEVELS.map((l) => (
            <Chip
              key={l}
              label={LEVEL_LABEL[l]}
              selected={level === l}
              onPress={() => setLevel(l)}
            />
          ))}
        </Row>
      </Field>

      {isTeaching ? (
        <Field label="Years of experience (optional)">
          <Input
            value={years}
            onChangeText={(v) => setYears(v.replace(/\D/g, '').slice(0, 2))}
            placeholder="3"
            keyboardType="number-pad"
          />
        </Field>
      ) : (
        <Field label="How much do you want this?">
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
            {PRIORITIES.map((p) => (
              <Chip
                key={p.value}
                label={p.label}
                selected={priority === p.value}
                onPress={() => setPriority(p.value)}
              />
            ))}
          </Row>
        </Field>
      )}

      <Field label="A note (optional)">
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder={
            isTeaching
              ? 'e.g. I focus on practical projects rather than theory'
              : 'e.g. I know the basics, I want to build a real project'
          }
          multiline
          numberOfLines={3}
          style={{ minHeight: 76, textAlignVertical: 'top' }}
          maxLength={300}
        />
      </Field>

      <Button
        label={isTeaching ? 'Add teaching skill' : 'Add learning goal'}
        onPress={() => void submit.run()}
        loading={submit.pending}
        disabled={!readyToSubmit}
      />
    </Screen>
  );
}
