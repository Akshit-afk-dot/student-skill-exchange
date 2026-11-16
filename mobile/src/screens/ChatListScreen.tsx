import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect } from 'react';
import { FlatList, View } from 'react-native';
import { chat } from '../api/endpoints';
import { RT, onEvent } from '../api/socket';
import { AnimatedListItem, PressableScale, SkeletonRows } from '../components/motion';
import { Avatar, Banner, EmptyState, IconButton, Screen, ScreenHeader, Text } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { chatTimestamp } from '../utils/format';
import type { ConversationView } from '../types';
import type { RootStackParamList } from '../navigation/types';

/** One conversation. Unread ones carry their weight in the type, not just in a badge. */
function ConversationRow({ item, index, onPress }: { item: ConversationView; index: number; onPress(): void }) {
  const t = useTheme();
  const unread = item.unread > 0;
  return (
    <AnimatedListItem index={index}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        accessibilityLabel={`${item.participant.name}${unread ? `, ${item.unread} unread` : ''}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          paddingVertical: t.spacing.md,
          paddingHorizontal: t.spacing.md,
          marginHorizontal: -t.spacing.md,
          borderRadius: t.radius.lg,
          backgroundColor: unread ? t.colors.primarySoft : 'transparent',
        }}
      >
        <Avatar
          name={item.participant.name}
          uri={item.participant.profileImage}
          online={item.participant.isOnline}
          size={54}
        />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 16, lineHeight: 22, fontWeight: unread ? '800' : '600', color: t.colors.text }}
            >
              {item.participant.name}
            </Text>
            {item.lastMessage ? (
              <Text
                style={{
                  fontSize: 12.5,
                  lineHeight: 17,
                  fontWeight: unread ? '700' : '500',
                  color: unread ? t.colors.primary : t.colors.textMuted,
                }}
              >
                {chatTimestamp(item.lastMessage.at)}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 14,
                lineHeight: 20,
                fontWeight: unread ? '600' : '400',
                color: unread ? t.colors.text : t.colors.textMuted,
              }}
            >
              {item.lastMessage?.body ?? 'You are connected. Say hello 👋'}
            </Text>
            {unread ? (
              <View
                style={{
                  minWidth: 22,
                  height: 22,
                  paddingHorizontal: 6,
                  borderRadius: 11,
                  backgroundColor: t.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: t.colors.onPrimary, fontSize: 12, lineHeight: 16, fontWeight: '800' }}>
                  {item.unread > 99 ? '99+' : item.unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </PressableScale>
    </AnimatedListItem>
  );
}

export function ChatListScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAsync(async () => chat.conversations(1), []);

  // Coming back from a chat should show the updated preview and unread count.
  useFocusEffect(
    useCallback(() => {
      state.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // A message arriving while this screen is open reorders the list immediately.
  useEffect(() => onEvent(RT.MESSAGE_NEW, () => state.refresh()), [state]);

  const unreadTotal = (state.data?.items ?? []).reduce((sum, c) => sum + c.unread, 0);

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ paddingHorizontal: t.spacing.page, paddingTop: t.spacing.lg }}>
        <ScreenHeader
          title="Chats"
          subtitle={unreadTotal > 0 ? `${unreadTotal} unread` : undefined}
          right={
            <IconButton
              icon="people-outline"
              accessibilityLabel="Your connections"
              onPress={() => navigation.navigate('Connections')}
            />
          }
        />
      </View>

      {state.loading ? (
        <View style={{ paddingHorizontal: t.spacing.page }}>
          <SkeletonRows count={6} />
        </View>
      ) : (
        <FlatList
          data={state.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.xl, gap: 2 }}
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={state.error ? <Banner tone="danger" text={state.error} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles"
              title="No conversations yet"
              message="Once a learning request is accepted, your chat with that student opens here."
              actionLabel="Find matches"
              onAction={() => navigation.navigate('Tabs', { screen: 'MatchesTab' })}
            />
          }
          renderItem={({ item, index }) => (
            <ConversationRow
              item={item}
              index={index}
              onPress={() =>
                navigation.navigate('Chat', {
                  conversationId: item.id,
                  partnerName: item.participant.name,
                  partnerId: item.participant.id,
                })
              }
            />
          )}
        />
      )}
    </Screen>
  );
}
