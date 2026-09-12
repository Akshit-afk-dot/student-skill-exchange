import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { chat } from '../api/endpoints';
import { RT, emitTyping, joinConversation, leaveConversation, onEvent } from '../api/socket';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { Banner, Body, Caption, Input, LoadingView, Row, Screen } from '../components/ui';
import { haptics } from '../utils/haptics';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { chatTimestamp } from '../utils/format';
import type { ChatMessage } from '../types';
import type { RootStackParamList } from '../navigation/types';

export function ChatScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { conversationId, partnerName, partnerId } =
    useRoute<RouteProp<RootStackParamList, 'Chat'>>().params;
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: partnerName });
  }, [navigation, partnerName]);

  const loadInitial = useCallback(async () => {
    try {
      const page = await chat.messages(conversationId, { limit: 30 });
      setMessages(page.items);
      setCursor(page.nextCursor);
      await chat.markRead(conversationId).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this conversation');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  // Live updates while the screen is open.
  useEffect(() => {
    joinConversation(conversationId);

    const offMessage = onEvent<ChatMessage>(RT.MESSAGE_NEW, (incoming) => {
      if (incoming.conversation !== conversationId) return;
      setMessages((prev) => {
        // The sender also receives their own message over the socket; the optimistic
        // copy is already in the list, so drop the duplicate.
        if (prev.some((m) => m._id === incoming._id)) return prev;
        haptics.selection();
        return [incoming, ...prev];
      });
      // Reading it as it arrives keeps the unread badge honest.
      void chat.markRead(conversationId).catch(() => undefined);
    });

    const offTyping = onEvent<{ conversationId: string; userId: string; isTyping: boolean }>(
      RT.TYPING,
      (payload) => {
        if (payload.conversationId !== conversationId || payload.userId === user?.id) return;
        setPartnerTyping(payload.isTyping);
      },
    );

    return () => {
      offMessage();
      offTyping();
      leaveConversation(conversationId);
    };
  }, [conversationId, user?.id]);

  function onChangeDraft(text: string) {
    setDraft(text);
    emitTyping(conversationId, text.length > 0);

    // Stop the indicator if the user pauses, so it does not stick on forever.
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(conversationId, false), 2500);
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setDraft('');
    emitTyping(conversationId, false);

    try {
      const message = await chat.send(conversationId, { body, type: 'TEXT' });
      haptics.tap();
      setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [message, ...prev]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message could not be sent');
      // Give the text back rather than losing what they typed.
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  async function loadOlder() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await chat.messages(conversationId, { limit: 30, before: cursor });
      setMessages((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      // Silent: the user still has the messages already loaded.
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) return <LoadingView />;

  return (
    <Screen padded={false} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        {error ? (
          <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md }}>
            <Banner tone="danger" text={error} />
          </View>
        ) : null}

        <FlatList
          data={messages}
          keyExtractor={(item) => item._id}
          // Newest at the bottom: the list renders reversed so new messages appear
          // without any manual scrolling.
          inverted
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm }}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={t.colors.primary} style={{ margin: 12 }} /> : null
          }
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }], alignItems: 'center', paddingTop: 60 }}>
              <Caption>No messages yet. Say hello.</Caption>
            </View>
          }
          renderItem={({ item }) => {
            const senderId = typeof item.sender === 'string' ? item.sender : item.sender._id;
            const mine = senderId === user?.id;
            return (
              <Animated.View
                // Bubbles slide in from the side they belong to, which makes a new
                // message read as arriving rather than simply appearing.
                entering={(mine ? SlideInRight : SlideInLeft).duration(220).springify().damping(20)}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  backgroundColor: mine ? t.colors.primary : t.colors.surface,
                  borderRadius: t.radius.lg,
                  borderBottomRightRadius: mine ? 4 : t.radius.lg,
                  borderBottomLeftRadius: mine ? t.radius.lg : 4,
                  paddingHorizontal: t.spacing.md,
                  paddingVertical: t.spacing.sm,
                  borderWidth: mine ? 0 : 1,
                  borderColor: t.colors.border,
                }}
              >
                <Body style={{ color: mine ? t.colors.textInverse : t.colors.text }}>
                  {item.body}
                </Body>
                <Row gap={4} style={{ alignSelf: 'flex-end', marginTop: 3 }}>
                  <Caption
                    style={{ color: mine ? t.colors.textInverse : t.colors.textMuted, opacity: 0.75 }}
                  >
                    {chatTimestamp(item.createdAt)}
                  </Caption>
                  {mine ? (
                    <Ionicons
                      name={item.readAt ? 'checkmark-done' : 'checkmark'}
                      size={13}
                      color={t.colors.textInverse}
                      style={{ opacity: 0.75 }}
                    />
                  ) : null}
                </Row>
              </Animated.View>
            );
          }}
        />

        {partnerTyping ? (
          <Caption style={{ paddingHorizontal: t.spacing.lg, paddingBottom: 4 }}>
            {partnerName.split(' ')[0]} is typing…
          </Caption>
        ) : null}

        <Row
          gap={t.spacing.sm}
          style={{
            padding: t.spacing.md,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
            backgroundColor: t.colors.bg,
            alignItems: 'flex-end',
          }}
        >
          <Pressable
            onPress={() =>
              navigation.navigate('ScheduleSession', { partnerId, partnerName })
            }
            accessibilityRole="button"
            accessibilityLabel="Schedule a session"
            hitSlop={6}
            style={{ padding: 8 }}
          >
            <Ionicons name="calendar-outline" size={22} color={t.colors.primary} />
          </Pressable>

          <Input
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Message…"
            multiline
            style={{ flex: 1, maxHeight: 110 }}
            maxLength={4000}
          />

          <Pressable
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: draft.trim() ? t.colors.primary : t.colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color={t.colors.textInverse} />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={draft.trim() ? t.colors.textInverse : t.colors.textMuted}
              />
            )}
          </Pressable>
        </Row>
      </KeyboardAvoidingView>
    </Screen>
  );
}
