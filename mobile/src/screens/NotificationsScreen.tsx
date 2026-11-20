import { useFocusEffect } from '@react-navigation/native';
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
} from '../components/ui';
import { haptics } from '../haptics';
import { useAction, useAsync } from '../hooks/useAsync';
import { useAuth } from '../store/auth';
import { dismissFromTray, setAppBadge } from '../notifications/device';
import { openNotification } from '../notifications/open';
import { NotificationGlyph } from '../notifications/visuals';
import { useTheme } from '../theme';
import type { AppNotification } from '../types';
import { timeAgo } from '../utils/format';

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
  const { user } = useAuth();
  const state = useAsync(async () => notificationsApi.list({ unreadOnly: true, page: 1 }), []);
  // Opened items disappear at once, before the server confirms, so the list never lags the tap.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const clearAll = useAction(async () => {
    await notificationsApi.markAllRead();
    haptics.success();
    // Nothing is news any more, on the phone's lock screen either.
    void dismissFromTray(() => true);
    setAppBadge(0);
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
    // Its copy in the phone's tray is stale now too.
    void dismissFromTray((data) => data.notificationId === item._id);
    // Unknown destinations still count as opened; the student simply stays here.
    openNotification({ ...item.data, notificationId: item._id }, user ? { id: user.id, name: user.name } : null, item.title);
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
            return (
              <AnimatedListItem index={index}>
                <PressableScale
                  onPress={() => open(item)}
                  scaleTo={0.98}
                  accessibilityLabel={`${item.title}. ${item.body}`}
                  accessibilityHint="Opens it and removes it from this list"
                  style={{ flexDirection: 'row', gap: t.spacing.md, paddingVertical: t.spacing.md }}
                >
                  <NotificationGlyph type={item.type} data={item.data} size={42} ring={t.colors.background} />

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
