import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { chat } from '../api/endpoints';
import { RT, onEvent } from '../api/socket';
import {
  Avatar,
  Banner,
  Body,
  Caption,
  EmptyState,
  Heading,
  LoadingView,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { chatTimestamp } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

export function ChatListScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAsync(async () => chat.conversations(1), []);

  // Coming back from a chat should show the updated preview and unread count.
  useFocusEffect(
    useCallback(() => {
      state.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // A message arriving while this screen is open reorders the list immediately.
  useEffect(() => onEvent(RT.MESSAGE_NEW, () => state.reload()), [state]);

  if (state.loading) return <LoadingView />;

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Title>Chats</Title>
          <Pressable
            onPress={() => navigation.navigate('Connections')}
            accessibilityRole="button"
            accessibilityLabel="Your connections"
            hitSlop={8}
          >
            <Ionicons name="people-outline" size={23} color={t.colors.text} />
          </Pressable>
        </Row>
      </View>

      <FlatList
        data={state.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xl }}
        refreshing={state.refreshing}
        onRefresh={state.refresh}
        ListHeaderComponent={state.error ? <Banner tone="danger" text={state.error} /> : null}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No conversations yet"
            message="Once a learning request is accepted, your chat with that student opens here."
            actionLabel="Find matches"
            onAction={() => navigation.navigate('Tabs', { screen: 'MatchesTab' })}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('Chat', {
                conversationId: item.id,
                partnerName: item.participant.name,
                partnerId: item.participant.id,
              })
            }
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.md,
              paddingVertical: t.spacing.md,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Avatar
              name={item.participant.name}
              uri={item.participant.profileImage}
              online={item.participant.isOnline}
              size={50}
            />
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Heading numberOfLines={1} style={{ flex: 1 }}>
                  {item.participant.name}
                </Heading>
                {item.lastMessage ? <Caption>{chatTimestamp(item.lastMessage.at)}</Caption> : null}
              </Row>
              <Row style={{ marginTop: 3 }}>
                <Body
                  small
                  muted={item.unread === 0}
                  numberOfLines={1}
                  style={{ flex: 1, fontWeight: item.unread > 0 ? '600' : '400' }}
                >
                  {item.lastMessage?.body ?? 'Say hello 👋'}
                </Body>
                {item.unread > 0 ? (
                  <View
                    style={{
                      minWidth: 21,
                      height: 21,
                      paddingHorizontal: 6,
                      borderRadius: 11,
                      backgroundColor: t.colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: t.spacing.sm,
                    }}
                  >
                    <Caption style={{ color: t.colors.textInverse, fontWeight: '700' }}>
                      {item.unread > 99 ? '99+' : item.unread}
                    </Caption>
                  </View>
                ) : null}
              </Row>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
