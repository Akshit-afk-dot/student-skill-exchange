import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { requests as requestsApi } from '../api/endpoints';
import { RequestCard } from '../components/cards';
import {
  Banner,
  Body,
  Button,
  Chip,
  EmptyState,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { SkeletonList } from '../components/motion';
import { haptics } from '../utils/haptics';
import { useAction, useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import type { RootStackParamList } from '../navigation/types';

export function LearningRequestsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('incoming');

  const state = useAsync(async () => requestsApi.list({ direction, page: 1 }), [direction]);

  // Accepting creates a connection, so it gets the success notification pattern;
  // declining and withdrawing get a duller thud. The difference is deliberate —
  // the two outcomes should not feel the same in the hand.
  const accept = useAction(async (id: string) => {
    const result = await requestsApi.accept(id);
    haptics.success();
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

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Title>Learning requests</Title>
        <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.md }}>
          <Chip
            label="Received"
            selected={direction === 'incoming'}
            onPress={() => setDirection('incoming')}
          />
          <Chip
            label="Sent"
            selected={direction === 'outgoing'}
            onPress={() => setDirection('outgoing')}
          />
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
          ListHeaderComponent={
            <>
              {state.error ? <Banner tone="danger" text={state.error} /> : null}
              {actionError ? <Banner tone="danger" text={actionError} /> : null}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              icon="mail-outline"
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
                      <Button
                        label="Accept"
                        onPress={async () => {
                          const result = await accept.run(item._id);
                          if (result) {
                            navigation.navigate('Chat', {
                              conversationId: result.conversationId,
                              partnerName: item.sender.name,
                              partnerId: item.sender._id,
                            });
                          }
                        }}
                        disabled={busy}
                        fullWidth={false}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label="Decline"
                        variant="ghost"
                        onPress={() => void reject.run(item._id)}
                        disabled={busy}
                        fullWidth={false}
                        style={{ flex: 1 }}
                      />
                    </Row>
                  ) : (
                    <Button
                      label="Withdraw request"
                      variant="ghost"
                      onPress={() => void cancel.run(item._id)}
                      disabled={busy}
                      fullWidth={false}
                    />
                  )
                ) : item.status === 'ACCEPTED' ? (
                  <Body small muted>
                    Accepted — find them under Chats.
                  </Body>
                ) : null
              }
            />
          )}
        />
      )}
    </Screen>
  );
}
