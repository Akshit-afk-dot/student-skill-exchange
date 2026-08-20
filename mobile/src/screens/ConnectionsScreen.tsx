import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, FlatList, View } from 'react-native';
import { connections as connectionsApi } from '../api/endpoints';
import {
  Avatar,
  Banner,
  Body,
  Caption,
  Card,
  Chip,
  EmptyState,
  Heading,
  LoadingView,
  Row,
  Screen,
  StarRating,
  Title,
} from '../components/ui';
import { useAction, useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { formatDate } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

export function ConnectionsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAsync(async () => connectionsApi.list(1), []);

  const remove = useAction(async (id: string) => {
    await connectionsApi.remove(id);
    state.reload();
  });

  function confirmRemove(id: string, name: string) {
    Alert.alert(
      `Disconnect from ${name}?`,
      'Your message history stays, but you will not be able to send new messages or schedule sessions until you reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => void remove.run(id) },
      ],
    );
  }

  if (state.loading) return <LoadingView />;

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Title>Connections</Title>
        <Body muted style={{ marginTop: 4 }}>
          Students you have an accepted exchange with.
        </Body>
      </View>

      <FlatList
        data={state.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: t.spacing.lg, paddingTop: t.spacing.sm }}
        refreshing={state.refreshing}
        onRefresh={state.refresh}
        ListHeaderComponent={
          <>
            {state.error ? <Banner tone="danger" text={state.error} /> : null}
            {remove.error ? <Banner tone="danger" text={remove.error} /> : null}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No connections yet"
            message="Accept a learning request, or send one and have it accepted, to connect with a student."
            actionLabel="Find matches"
            onAction={() => navigation.navigate('Tabs', { screen: 'MatchesTab' })}
          />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: t.spacing.md }}>
            <Row gap={t.spacing.md} style={{ alignItems: 'flex-start' }}>
              <Avatar
                name={item.student.name}
                uri={item.student.profileImage}
                online={item.student.isOnline}
              />
              <View style={{ flex: 1 }}>
                <Heading numberOfLines={1}>{item.student.name}</Heading>
                {item.student.college ? (
                  <Caption numberOfLines={1}>
                    {item.student.college}
                    {item.student.department ? ` · ${item.student.department}` : ''}
                  </Caption>
                ) : null}
                <Row gap={t.spacing.md} style={{ marginTop: 4 }}>
                  <StarRating value={item.student.rating} showValue />
                  <Caption>Connected {formatDate(item.connectedAt)}</Caption>
                </Row>

                <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.md, flexWrap: 'wrap' }}>
                  {item.conversationId ? (
                    <Chip
                      label="Message"
                      icon="chatbubble-outline"
                      tone="primary"
                      onPress={() =>
                        navigation.navigate('Chat', {
                          conversationId: item.conversationId as string,
                          partnerName: item.student.name,
                          partnerId: item.student.id,
                        })
                      }
                    />
                  ) : null}
                  <Chip
                    label="Schedule"
                    icon="calendar-outline"
                    onPress={() =>
                      navigation.navigate('ScheduleSession', {
                        partnerId: item.student.id,
                        partnerName: item.student.name,
                      })
                    }
                  />
                  <Chip
                    label="Profile"
                    icon="person-outline"
                    onPress={() =>
                      navigation.navigate('StudentProfile', { userId: item.student.id })
                    }
                  />
                  <Chip
                    label="Disconnect"
                    tone="danger"
                    onPress={() => confirmRemove(item.id, item.student.name)}
                  />
                </Row>
              </View>
            </Row>
          </Card>
        )}
      />
    </Screen>
  );
}
