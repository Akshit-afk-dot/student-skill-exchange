import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { skills as skillsApi } from '../api/endpoints';
import { FadeInView, Skeleton } from '../components/motion';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Field,
  Heading,
  IconTile,
  Input,
  Overline,
  Row,
  Screen,
  Text,
  TextButton,
  Title,
  toneColours,
  type Tone,
} from '../components/ui';
import { useAction, useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { LEVEL_LABEL } from '../utils/format';
import { SKILL_LEVELS, type Skill, type SkillCategory, type SkillLevel, type SkillNameCheck } from '../types';
import type { RootStackParamList } from '../navigation/types';
import { haptics } from '../haptics';

const PRIORITIES = [
  { value: 1, label: 'Nice to have' },
  { value: 2, label: 'Important' },
  { value: 3, label: 'Top priority' },
];

/** Matches COMMUNITY_APPROVAL_STUDENTS in the server's skills service. */
const COMMUNITY_APPROVAL_STUDENTS = 3;

/**
 * A soft panel with an icon and words. Unlike `Banner` it never buzzes: the verdict on a
 * new skill name changes as the student types, and a buzz per keystroke would be noise.
 */
function Notice({ tone, icon, children }: { tone: Tone; icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  const t = useTheme();
  const c = toneColours(t, tone);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: c.bg,
        borderRadius: t.radius.md,
        padding: t.spacing.md,
        marginBottom: t.spacing.lg,
      }}
    >
      <Ionicons name={icon} size={19} color={c.fg} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: c.fg, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

/**
 * What happens to a name that is not in the search results, as the server judged it:
 * it already is a skill, it is probably one ("Did you mean…?"), it can be added as a new
 * skill (with a category), or it cannot be added and why.
 */
function NewSkillPanel({
  verdict,
  stale,
  unchecked,
  isTeaching,
  keepOwn,
  categories,
  categoryId,
  onUse,
  onKeep,
  onCategory,
}: {
  verdict: SkillNameCheck;
  /** The student has typed on since this verdict: shown dimmed until the new one arrives. */
  stale: boolean;
  /** The name could not be checked as they typed; it is checked when they add it. */
  unchecked: boolean;
  isTeaching: boolean;
  keepOwn: boolean;
  categories: SkillCategory[];
  categoryId: string | null;
  onUse(skill: Skill): void;
  onKeep(): void;
  onCategory(id: string): void;
}) {
  const t = useTheme();

  if (verdict.status === 'INVALID') {
    return (
      <View style={{ opacity: stale ? 0.5 : 1 }}>
        <Notice tone="danger" icon="alert-circle">
          {verdict.message}
        </Notice>
      </View>
    );
  }

  let body: ReactNode;
  if (verdict.status === 'EXISTING') {
    const skill = verdict.skill;
    body = (
      <>
        <Row gap={t.spacing.md}>
          <IconTile icon="checkmark-circle" tone="success" size={40} />
          <View style={{ flex: 1 }}>
            <Heading>{skill.name}</Heading>
            <Caption>Already a skill{skill.category ? ` in ${skill.category.name}` : ''}</Caption>
          </View>
        </Row>
        <Button
          label={`Use ${skill.name}`}
          variant="tonal"
          size="md"
          onPress={() => onUse(skill)}
          style={{ marginTop: t.spacing.md }}
        />
      </>
    );
  } else if (verdict.status === 'SUGGESTION' && !keepOwn) {
    const skill = verdict.suggestion;
    const typo = verdict.kind === 'TYPO';
    body = (
      <>
        <Row gap={t.spacing.md} style={{ alignItems: 'flex-start' }}>
          <IconTile icon={typo ? 'help-circle' : 'git-merge'} tone="primary" size={40} />
          <View style={{ flex: 1 }}>
            <Heading>{typo ? `Did you mean ${skill.name}?` : `${skill.name} is already a skill`}</Heading>
            <Caption style={{ marginTop: 2 }}>
              {typo
                ? `Pick ${skill.name} to be matched with everyone who listed it.`
                : `Add ${skill.name} and set your level below, rather than a separate “${verdict.name}”.`}
            </Caption>
          </View>
        </Row>
        <Button
          label={`Use ${skill.name}`}
          variant="tonal"
          size="md"
          onPress={() => onUse(skill)}
          style={{ marginTop: t.spacing.md }}
        />
        <TextButton
          label={`No, add “${verdict.name}”`}
          onPress={onKeep}
          style={{ alignSelf: 'center', marginTop: t.spacing.sm }}
        />
      </>
    );
  } else {
    const name = verdict.name;
    const students = verdict.status === 'NEW' ? verdict.students : 0;
    body = (
      <>
        <Row gap={t.spacing.md} style={{ alignItems: 'flex-start' }}>
          <IconTile icon="add" tone={isTeaching ? 'teach' : 'learn'} size={40} />
          <View style={{ flex: 1 }}>
            <Heading>Add “{name}”</Heading>
            <Caption style={{ marginTop: 2 }}>
              {unchecked
                ? 'A new skill. We’ll check the name when you add it.'
                : students > 0
                  ? `A new skill. ${students} other student${students === 1 ? ' has' : 's have'} added it too.`
                  : 'A new skill, not in the catalogue yet.'}
            </Caption>
          </View>
        </Row>

        <Overline style={{ marginTop: t.spacing.lg, marginBottom: t.spacing.sm }}>Pick its category</Overline>
        <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              selected={categoryId === category.id}
              onPress={() => onCategory(category.id)}
            />
          ))}
        </Row>

        <Row gap={8} style={{ marginTop: t.spacing.lg, alignItems: 'flex-start' }}>
          <Ionicons name="shield-checkmark-outline" size={16} color={t.colors.textSecondary} style={{ marginTop: 1 }} />
          <Caption style={{ flex: 1 }}>
            It shows on your profile straight away. Other students can find it once a moderator approves
            it, or once {COMMUNITY_APPROVAL_STUDENTS} students have added it.
          </Caption>
        </Row>
      </>
    );
  }

  return <Card style={{ marginBottom: t.spacing.lg, opacity: stale ? 0.5 : 1 }}>{body}</Card>;
}

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
  /** The student turned down "Did you mean…?" and keeps the name they typed. */
  const [keepOwn, setKeepOwn] = useState(false);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // A new name gets a fresh verdict; an earlier "keep my name" does not carry over.
  useEffect(() => setKeepOwn(false), [debounced]);

  const results = useAsync(
    async () => (debounced.length >= 2 ? skillsApi.search({ q: debounced, limit: 12 }) : null),
    [debounced],
  );
  const categories = useAsync(async () => skillsApi.categories(), []);

  const exactMatch = (results.data?.items ?? []).some(
    (s) => s.name.toLowerCase() === debounced.toLowerCase(),
  );
  const canPropose = debounced.length >= 2 && !exactMatch && !selected;

  const nameCheck = useAsync(
    async () => (canPropose ? skillsApi.check(debounced) : null),
    [debounced, canPropose],
  );
  /**
   * The name could not be checked: no connection, or a server older than the check. The
   * student can still add it, because the server runs the same checks when the skill is
   * added and any problem comes back in the banner at the top. A raw request error here
   * would be a dead end for a perfectly good skill.
   */
  const unchecked = canPropose && !nameCheck.loading && Boolean(nameCheck.error);
  const verdict: SkillNameCheck | null = !canPropose
    ? null
    : unchecked
      ? { status: 'NEW', name: debounced, students: 0 }
      : nameCheck.data;
  const stale = nameCheck.loading || query.trim() !== debounced;

  /** The name to add, once the verdict allows adding one. */
  const proposal =
    verdict?.status === 'NEW' || (verdict?.status === 'SUGGESTION' && keepOwn) ? verdict.name : null;

  function choose(skill: Skill) {
    setSelected(skill);
    setKeepOwn(false);
  }

  function keepTypedName() {
    setKeepOwn(true);
    // Start from the category of the skill it resembled; the student can change it.
    if (verdict?.status === 'SUGGESTION' && verdict.suggestion.category && !categoryId) {
      setCategoryId(verdict.suggestion.category.id);
    }
    haptics.selection();
  }

  const submit = useAction(async () => {
    await skillsApi.add({
      ...(selected
        ? { skillId: selected.id }
        : {
            skillName: proposal ?? debounced,
            categoryId: categoryId ?? undefined,
            ...(keepOwn ? { allowSimilar: true } : {}),
          }),
      type,
      level,
      ...(isTeaching && years ? { yearsOfExperience: Number(years) } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(!isTeaching ? { priority } : {}),
    });
    haptics.success();
    navigation.goBack();
  });

  const readyToSubmit = Boolean(selected) || (Boolean(proposal) && Boolean(categoryId) && !stale);

  return (
    <Screen scroll>
      <Title>{isTeaching ? 'Add a teaching skill' : 'Add a learning goal'}</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        {isTeaching
          ? 'What can you help another student with?'
          : 'What do you want someone to teach you?'}
      </Body>

      {submit.error ? <Banner tone="danger" text={submit.error} /> : null}

      <Field label="Skill" hint={selected ? undefined : 'Pick from the list, or add one that isn’t there yet.'}>
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
            maxLength={60}
          />
        )}
      </Field>

      {!selected && (results.data?.items ?? []).length > 0 ? (
        <View style={{ marginBottom: t.spacing.lg }}>
          {(results.data?.items ?? []).map((skill) => (
            <Pressable
              key={skill.id}
              onPress={() => choose(skill)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                paddingVertical: 11,
                paddingHorizontal: t.spacing.md,
                borderRadius: t.radius.sm,
                backgroundColor: pressed ? t.colors.surfaceContainer : 'transparent',
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
        <FadeInView>
          {verdict ? (
            <NewSkillPanel
              verdict={verdict}
              stale={stale}
              unchecked={unchecked}
              isTeaching={isTeaching}
              keepOwn={keepOwn}
              categories={categories.data ?? []}
              categoryId={categoryId}
              onUse={choose}
              onKeep={keepTypedName}
              onCategory={setCategoryId}
            />
          ) : (
            <Card style={{ marginBottom: t.spacing.lg }}>
              <Row gap={t.spacing.md}>
                <Skeleton width={40} height={40} radius={t.radius.md} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="60%" height={18} />
                  <Skeleton width="85%" height={13} />
                </View>
              </Row>
            </Card>
          )}
        </FadeInView>
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
