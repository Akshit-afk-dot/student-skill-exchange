import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { requests as requestsApi } from '../api/endpoints';
import { RequestCard } from '../components/cards';
import { ConnectionCelebration } from '../components/ConnectionCelebration';
import { SkeletonList } from '../components/motion';
import { Banner, Button, Caption, EmptyState, Row, Screen, Segmented } from '../components/ui';
import { haptics } from '../haptics';
import { useAction, useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import type { LearningRequest } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Direction = 'incoming' | 'outgoing';

interface Celebration {
  request: LearningRequest;
  conversationId: string;
}

export function LearningRequestsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [direction, setDirection] = useState<Direction>('incoming');
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const state = useAsync(async () => requestsApi.list({ direction, page: 1 }), [direction]);

  // Accepting makes a connection, the best thing that happens in this app, so it gets
  // the full celebration (which plays its own haptics). Declining and withdrawing get a
  // dull reject buzz. The two outcomes should not feel alike in the hand.
  const accept = useAction(async (request: LearningRequest) => {
    const result = await requestsApi.accept(request._id);
    setCelebration({ request, conversationId: result.conversationId });
    state.reload();
    return result;
  });
  const reject = useAction(async (id: string) => {
    await requestsApi.reject(id);
    haptics.reject();
    state.reload();
  });
  const cancel = useAction(async (id: string) => {
    await requestsApi.cancel(id);
    haptics.reject();
    state.reload();
  });

  const busy = accept.pending || reject.pending || cancel.pending;
  const actionError = accept.error ?? reject.error ?? cancel.error;
  const pendingCount = (state.data?.items ?? []).filter((r) => r.status === 'PENDING').length;

  return (
    <Screen padded={false} edges={[]}>
      <View style={{ paddingHorizontal: t.spacing.page, paddingTop: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Segmented<Direction>
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'incoming', label: 'Received', icon: 'arrow-down' },
            { value: 'outgoing', label: 'Sent', icon: 'arrow-up' },
          ]}
        />
        {!state.loading && pendingCount > 0 ? (
          <Caption style={{ marginTop: t.spacing.md }}>
            {pendingCount} waiting for {direction === 'incoming' ? 'your answer' : 'a reply'}
          </Caption>
        ) : null}
      </View>

      {state.loading ? (
        <View style={{ paddingHorizontal: t.spacing.page, paddingTop: t.spacing.sm }}>
          <SkeletonList count={3} lines={2} />
        </View>
      ) : (
        <FlatList
          data={state.data?.items ?? []}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            paddingHorizontal: t.spacing.page,
            paddingTop: t.spacing.sm,
            paddingBottom: t.spacing.xxl,
          }}
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {state.error ? <Banner tone="danger" text={state.error} /> : null}
              {actionError ? <Banner tone="danger" text={actionError} /> : null}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              icon={direction === 'incoming' ? 'mail-open' : 'paper-plane'}
              title={direction === 'incoming' ? 'No requests yet' : 'You have not sent any'}
              message={
                direction === 'incoming'
                  ? 'When another student asks you to teach them, it will appear here.'
                  : 'Find a match and send them a request to get started.'
              }
              actionLabel={direction === 'outgoing' ? 'Find matches' : undefined}
              onAction={() => navigation.navigate('Tabs', { screen: 'MatchesTab' })}
            />
          }
          renderItem={({ item, index }) => (
            <RequestCard
              index={index}
              request={item}
              direction={direction}
              onPress={() =>
                navigation.navigate('StudentProfile', {
                  userId: direction === 'incoming' ? item.sender._id : item.receiver._id,
                })
              }
              actions={
                item.status === 'PENDING' ? (
                  direction === 'incoming' ? (
                    <Row gap={t.spacing.sm}>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Decline"
                          variant="secondary"
                          size="md"
                          onPress={() => void reject.run(item._id)}
                          disabled={busy}
                        />
                      </View>
                      <View style={{ flex: 1.4 }}>
                        <Button
                          label="Accept"
                          variant="success"
                          size="md"
                          icon="checkmark"
                          onPress={() => void accept.run(item)}
                          loading={accept.pending}
                          disabled={busy && !accept.pending}
                        />
                      </View>
                    </Row>
                  ) : (
                    <Button
                      label="Withdraw request"
                      variant="secondary"
                      size="md"
                      onPress={() => void cancel.run(item._id)}
                      disabled={busy}
                    />
                  )
                ) : null
              }
            />
          )}
        />
      )}

      {celebration ? (
        <ConnectionCelebration
          visible
          me={{ name: user?.name ?? 'You', profileImage: user?.profileImage }}
          partner={{
            name: celebration.request.sender.name,
            profileImage: celebration.request.sender.profileImage,
          }}
          skill={celebration.request.skill.name}
          onClose={() => setCelebration(null)}
          onMessage={() => {
            const { request, conversationId } = celebration;
            setCelebration(null);
            navigation.navigate('Chat', {
              conversationId,
              partnerName: request.sender.name,
              partnerId: request.sender._id,
            });
          }}
        />
      ) : null}
    </Screen>
  );
}
