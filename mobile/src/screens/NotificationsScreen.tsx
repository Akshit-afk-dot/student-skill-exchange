import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { notifications as notificationsApi } from '../api/endpoints';
import { RT, onEvent } from '../api/socket';
import {
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
import { useAction, useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { timeAgo } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

type Tone = 'primary' | 'success' | 'warning' | 'danger';

/** Icon and tone per notification type. */
const META: Record<string, { icon: keyof typeof Ionicons.glyphMap; tone: Tone }> = {
  REQUEST_RECEIVED: { icon: 'mail-outline', tone: 'warning' },
  REQUEST_ACCEPTED: { icon: 'checkmark-circle-outline', tone: 'success' },
  REQUEST_REJECTED: { icon: 'close-circle-outline', tone: 'danger' },
  MESSAGE_RECEIVED: { icon: 'chatbubble-outline', tone: 'primary' },
  SESSION_SCHEDULED: { icon: 'calendar-outline', tone: 'primary' },
  SESSION_REMINDER: { icon: 'alarm-outline', tone: 'warning' },
  SESSION_CANCELLED: { icon: 'close-circle-outline', tone: 'danger' },
  SESSION_COMPLETED: { icon: 'checkmark-done-outline', tone: 'success' },
  REVIEW_RECEIVED: { icon: 'star-outline', tone: 'warning' },
  NEW_MATCH: { icon: 'sparkles-outline', tone: 'primary' },
  BADGE_EARNED: { icon: 'trophy-outline', tone: 'success' },
  MODERATION_NOTICE: { icon: 'warning-outline', tone: 'danger' },
};

export function NotificationsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAsync(async () => notificationsApi.list({ page: 1 }), []);

  const markAll = useAction(async () => {
    await notificationsApi.markAllRead();
    state.reload();
  });

  // Anything arriving while this screen is open shows up without a manual pull.
  useEffect(() => onEvent(RT.NOTIFICATION, () => state.reload()), [state]);

  /** Routes a notification to the screen its payload points at. */
  function open(data: Record<string, string>, id: string, read: boolean) {
    if (!read) void notificationsApi.markRead([id]).then(() => state.reload());

    switch (data.screen) {
      case 'Chat':
        if (data.conversationId) {
          navigation.navigate('Chat', {
            conversationId: data.conversationId,
            partnerName: data.partnerName ?? 'Chat',
            partnerId: data.partnerId ?? '',
          });
        }
        break;
      case 'SessionDetails':
        if (data.sessionId) navigation.navigate('SessionDetails', { sessionId: data.sessionId });
        break;
      case 'LearningRequests':
        navigation.navigate('LearningRequests');
        break;
      case 'MySessions':
        navigation.navigate('MySessions');
        break;
      case 'Badges':
        navigation.navigate('Badges');
        break;
      case 'Settings':
        navigation.navigate('Settings');
        break;
      default:
        // Unknown deep link: stay put rather than navigating somewhere arbitrary.
        break;
    }
  }

  if (state.loading) return <LoadingView />;

  const items = state.data?.items ?? [];
  const unread = items.filter((n) => !n.read).length;

  const tints: Record<Tone, { fg: string; bg: string }> = {
    primary: { fg: t.colors.primary, bg: t.colors.primarySoft },
    success: { fg: t.colors.success, bg: t.colors.successSoft },
    warning: { fg: t.colors.warning, bg: t.colors.warningSoft },
    danger: { fg: t.colors.danger, bg: t.colors.dangerSoft },
  };

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Title>Notifications</Title>
          {unread > 0 ? (
            <Pressable onPress={() => void markAll.run()} hitSlop={8} accessibilityRole="button">
              <Body small style={{ color: t.colors.primary, fontWeight: '600' }}>
                Mark all read
              </Body>
            </Pressable>
          ) : null}
        </Row>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xl }}
        refreshing={state.refreshing}
        onRefresh={state.refresh}
        ListHeaderComponent={state.error ? <Banner tone="danger" text={state.error} /> : null}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="Nothing here yet"
            message="Requests, messages, session reminders and ratings will show up here."
          />
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: t.colors.border, opacity: 0.5 }} />
        )}
        renderItem={({ item }) => {
          const meta = META[item.type] ?? { icon: 'notifications-outline' as const, tone: 'primary' as Tone };
          const tint = tints[meta.tone];

          return (
            <Pressable
              onPress={() => open(item.data ?? {}, item._id, item.read)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: t.spacing.md,
                paddingVertical: t.spacing.md,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: tint.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={meta.icon} size={18} color={tint.fg} />
              </View>

              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Heading
                    numberOfLines={1}
                    style={{ flex: 1, fontWeight: item.read ? '500' : '700' }}
                  >
                    {item.title}
                  </Heading>
                  <Caption>{timeAgo(item.createdAt)}</Caption>
                </Row>
                <Body small muted numberOfLines={2} style={{ marginTop: 2 }}>
                  {item.body}
                </Body>
              </View>

              {!item.read ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: t.colors.primary,
                    alignSelf: 'center',
                  }}
                />
              ) : null}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
