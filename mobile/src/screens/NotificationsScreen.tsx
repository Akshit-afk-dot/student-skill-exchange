import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { notifications as notificationsApi } from '../api/endpoints';
import { RT, onEvent } from '../api/socket';
import { AnimatedListItem, PressableScale, SkeletonRows } from '../components/motion';
import {
  Banner,
  Body,
  Caption,
  EmptyState,
  Heading,
  Row,
  Screen,
  TextButton,
  toneColours,
  type Tone,
} from '../components/ui';
import { haptics } from '../haptics';
import { useAction, useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import type { AppNotification } from '../types';
import { timeAgo } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

/**
 * Icon and tone per notification type. Colour follows the app-wide meanings: green for
 * something that went right, gold for rewards, the brand for everything routine. Red is
 * kept for genuine problems, so a declined request is neutral, not an error.
 */
const META: Record<string, { icon: keyof typeof Ionicons.glyphMap; tone: Tone }> = {
  REQUEST_RECEIVED: { icon: 'mail-outline', tone: 'primary' },
  REQUEST_ACCEPTED: { icon: 'checkmark-circle-outline', tone: 'success' },
  REQUEST_REJECTED: { icon: 'close-circle-outline', tone: 'neutral' },
  MESSAGE_RECEIVED: { icon: 'chatbubble-outline', tone: 'primary' },
  SESSION_SCHEDULED: { icon: 'calendar-outline', tone: 'primary' },
  SESSION_REMINDER: { icon: 'alarm-outline', tone: 'primary' },
  SESSION_CANCELLED: { icon: 'close-circle-outline', tone: 'neutral' },
  SESSION_COMPLETED: { icon: 'checkmark-done-outline', tone: 'success' },
  REVIEW_RECEIVED: { icon: 'star-outline', tone: 'reward' },
  NEW_MATCH: { icon: 'sparkles-outline', tone: 'primary' },
  BADGE_EARNED: { icon: 'trophy-outline', tone: 'reward' },
  MODERATION_NOTICE: { icon: 'warning-outline', tone: 'warning' },
};

/**
 * The notification centre: only what still needs attention.
 *
 * A notification leaves the list once it has been dealt with. Opening it counts, and so
 * does doing the thing it was about anywhere in the app (reading the chat, answering the
 * request, confirming the session), which the server resolves on its own. When the list
 * is empty the student has nothing outstanding, and the screen says so.
 */
export function NotificationsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const state = useAsync(async () => notificationsApi.list({ unreadOnly: true, page: 1 }), []);
  // Opened items disappear at once, before the server confirms, so the list never lags the tap.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const clearAll = useAction(async () => {
    await notificationsApi.markAllRead();
    haptics.success();
    state.refresh();
  });

  // Coming back from whatever an alert opened: anything dealt with there is gone.
  useFocusEffect(
    useCallback(() => {
      state.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // New alerts, and alerts resolved elsewhere (on another screen or device), keep this live.
  useEffect(() => {
    const offNew = onEvent(RT.NOTIFICATION, () => state.refresh());
    const offRead = onEvent(RT.NOTIFICATION_READ, () => state.refresh());
    return () => {
      offNew();
      offRead();
    };
  }, [state]);

  /** Dismisses a notification and routes to the screen its payload points at. */
  function open(item: AppNotification) {
    setDismissed((prev) => new Set(prev).add(item._id));
    void notificationsApi.markRead([item._id]).catch(() => undefined);

    const data = item.data ?? {};
    switch (data.screen) {
      case 'Chat':
        if (data.conversationId) {
          navigation.navigate('Chat', {
            conversationId: data.conversationId,
            partnerName: data.partnerName || item.title,
            partnerId: data.partnerId ?? '',
          });
        }
        break;
      case 'SessionDetails':
        if (data.sessionId) navigation.navigate('SessionDetails', { sessionId: data.sessionId });
        break;
      case 'Reviews':
        // "Rate your session" opens the session, where the rating button is; a new review
        // received opens the reviews about you.
        if (data.sessionId) navigation.navigate('SessionDetails', { sessionId: data.sessionId });
        else if (user) navigation.navigate('Reviews', { userId: user.id, userName: user.name });
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
        // Unknown deep link: dismissed, and the student stays here.
        break;
    }
  }

  const items = (state.data?.items ?? []).filter((n) => !n.read && !dismissed.has(n._id));

  return (
    <Screen padded={false} edges={[]}>
      {items.length > 0 ? (
        <Row
          style={{
            justifyContent: 'space-between',
            paddingHorizontal: t.spacing.page,
            paddingTop: t.spacing.md,
            paddingBottom: t.spacing.xs,
          }}
        >
          <Body muted>{items.length === 1 ? '1 new' : `${items.length} new`}</Body>
          <TextButton label="Clear all" size={14} onPress={() => void clearAll.run()} />
        </Row>
      ) : null}

      {state.loading ? (
        <View style={{ paddingHorizontal: t.spacing.page }}>
          <SkeletonRows count={5} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.xl, flexGrow: 1 }}
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {state.error ? <Banner tone="danger" text={state.error} /> : null}
              {clearAll.error ? <Banner tone="danger" text={clearAll.error} /> : null}
            </>
          }
          ListEmptyComponent={
            state.error ? null : (
              <EmptyState
                icon="checkmark-done"
                tone="success"
                title="No new notifications"
                message="You're all caught up. New requests, messages and session updates will show up here."
              />
            )
          }
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.colors.border }} />}
          renderItem={({ item, index }) => {
            const meta = META[item.type] ?? { icon: 'notifications-outline' as const, tone: 'primary' as Tone };
            const tint = toneColours(t, meta.tone);

            return (
              <AnimatedListItem index={index}>
                <PressableScale
                  onPress={() => open(item)}
                  scaleTo={0.98}
                  accessibilityLabel={`${item.title}. ${item.body}`}
                  accessibilityHint="Opens it and removes it from this list"
                  style={{ flexDirection: 'row', gap: t.spacing.md, paddingVertical: t.spacing.md }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: tint.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={meta.icon} size={19} color={tint.fg} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Heading numberOfLines={2}>{item.title}</Heading>
                    <Body small muted numberOfLines={2} style={{ marginTop: 2 }}>
                      {item.body}
                    </Body>
                    <Caption style={{ marginTop: 4 }}>{timeAgo(item.createdAt)}</Caption>
                  </View>
                </PressableScale>
              </AnimatedListItem>
            );
          }}
        />
      )}
    </Screen>
  );
}
