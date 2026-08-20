import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { skills as skillsApi } from '../api/endpoints';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  EmptyState,
  LoadingView,
  Row,
  Screen,
  SectionHeader,
  Title,
} from '../components/ui';
import { useAction, useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { LEVEL_LABEL } from '../utils/format';
import type { UserSkillEntry } from '../types';
import type { RootStackParamList } from '../navigation/types';

export function MySkillsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAsync(async () => skillsApi.mine(), []);

  // Returning from Add Skill must show the new entry without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      state.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const remove = useAction(async (id: string) => {
    await skillsApi.remove(id);
    state.reload();
  });

  function confirmRemove(entry: UserSkillEntry) {
    Alert.alert(
      `Remove ${entry.skill.name}?`,
      'It will no longer be used when matching you with other students.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void remove.run(entry._id) },
      ],
    );
  }

  if (state.loading) return <LoadingView />;

  const teaches = state.data?.teaches ?? [];
  const learns = state.data?.learns ?? [];

  const renderList = (entries: UserSkillEntry[], tone: 'primary' | 'warning') =>
    entries.map((entry) => (
      <Card key={entry._id} style={{ marginBottom: t.spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Body>{entry.skill.name}</Body>
            <Row gap={6} style={{ marginTop: 6 }}>
              <Chip label={LEVEL_LABEL[entry.level]} tone={tone} />
              {entry.yearsOfExperience ? (
                <Caption>
                  {entry.yearsOfExperience} yr{entry.yearsOfExperience === 1 ? '' : 's'}
                </Caption>
              ) : null}
              {tone === 'warning' && entry.priority > 1 ? (
                <Chip label={entry.priority === 3 ? 'Top priority' : 'Important'} tone="danger" />
              ) : null}
            </Row>
            {entry.description ? (
              <Caption style={{ marginTop: 6 }}>{entry.description}</Caption>
            ) : null}
          </View>
          <Pressable
            onPress={() => confirmRemove(entry)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${entry.skill.name}`}
            hitSlop={10}
            style={{ padding: 4 }}
          >
            <Ionicons name="trash-outline" size={19} color={t.colors.danger} />
          </Pressable>
        </Row>
      </Card>
    ));

  return (
    <Screen scroll refreshing={state.refreshing} onRefresh={state.refresh}>
      <Title>My skills</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        The matching algorithm works from these two lists.
      </Body>

      {state.error ? <Banner tone="danger" text={state.error} /> : null}
      {remove.error ? <Banner tone="danger" text={remove.error} /> : null}

      <SectionHeader title={`I can teach (${teaches.length})`} />
      {teaches.length === 0 ? (
        <Card style={{ marginBottom: t.spacing.md }}>
          <Body muted>
            Nothing here yet. Even one skill you are comfortable explaining is enough to start.
          </Body>
        </Card>
      ) : (
        renderList(teaches, 'primary')
      )}
      <Button
        label="Add a teaching skill"
        variant="secondary"
        icon="add"
        onPress={() => navigation.navigate('AddSkill', { type: 'TEACH' })}
        style={{ marginBottom: t.spacing.xl }}
      />

      <SectionHeader title={`I want to learn (${learns.length})`} />
      {learns.length === 0 ? (
        <Card style={{ marginBottom: t.spacing.md }}>
          <Body muted>Add what you want to learn so we can find someone to teach you.</Body>
        </Card>
      ) : (
        renderList(learns, 'warning')
      )}
      <Button
        label="Add a learning goal"
        variant="secondary"
        icon="add"
        onPress={() => navigation.navigate('AddSkill', { type: 'LEARN' })}
      />

      {teaches.length === 0 && learns.length === 0 ? (
        <EmptyState
          icon="bulb-outline"
          title="Start with one of each"
          message="One skill you can teach and one you want to learn is all the matcher needs."
        />
      ) : null}
    </Screen>
  );
}
