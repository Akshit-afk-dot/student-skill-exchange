import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { sessions as sessionsApi } from '../api/endpoints';
import { SessionCard } from '../components/cards';
import {
  Banner,
  Chip,
  EmptyState,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { SkeletonList } from '../components/motion';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import type { RootStackParamList } from '../navigation/types';

export function MySessionsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [role, setRole] = useState<'all' | 'teacher' | 'learner'>('all');

  const state = useAsync(
    async () =>
      sessionsApi.list({ when, ...(role === 'all' ? {} : { role }), page: 1 }),
    [when, role],
  );

  // Completing or cancelling on the details screen should be reflected on return.
  useFocusEffect(
    useCallback(() => {
      state.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [when, role]),
  );

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Title>Sessions</Title>
          <Pressable
            onPress={() => navigation.navigate('Calendar')}
            accessibilityRole="button"
            accessibilityLabel="Calendar view"
            hitSlop={8}
          >
            <Ionicons name="calendar-outline" size={23} color={t.colors.text} />
          </Pressable>
        </Row>

        <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.md }}>
          <Chip label="Upcoming" selected={when === 'upcoming'} onPress={() => setWhen('upcoming')} />
          <Chip label="Past" selected={when === 'past'} onPress={() => setWhen('past')} />
        </Row>

        <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.sm }}>
          <Chip label="All" selected={role === 'all'} onPress={() => setRole('all')} />
          <Chip label="Teaching" selected={role === 'teacher'} onPress={() => setRole('teacher')} />
          <Chip label="Learning" selected={role === 'learner'} onPress={() => setRole('learner')} />
        </Row>
      </View>

      {state.loading ? (
        <View style={{ paddingHorizontal: t.spacing.lg }}>
          <SkeletonList count={3} lines={2} />
        </View>
      ) : (
        <FlatList
          data={state.data?.items ?? []}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: t.spacing.lg, paddingTop: t.spacing.sm }}
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          ListHeaderComponent={state.error ? <Banner tone="danger" text={state.error} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={when === 'upcoming' ? 'Nothing scheduled' : 'No past sessions'}
              message={
                when === 'upcoming'
                  ? 'Once you are connected with a student, schedule a session from their profile or your chat.'
                  : 'Sessions you have completed will be listed here.'
              }
              actionLabel={when === 'upcoming' ? 'View connections' : undefined}
              onAction={() => navigation.navigate('Connections')}
            />
          }
          renderItem={({ item, index }) => (
            <SessionCard
              index={index}
              session={item}
              currentUserId={user?.id ?? ''}
              onPress={() => navigation.navigate('SessionDetails', { sessionId: item._id })}
            />
          )}
        />
      )}
    </Screen>
  );
}
