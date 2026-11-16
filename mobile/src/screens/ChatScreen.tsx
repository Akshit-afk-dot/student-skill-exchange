import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { chat } from '../api/endpoints';
import { RT, emitTyping, joinConversation, leaveConversation, onEvent } from '../api/socket';
import { LAYOUT_ANIMATIONS_SUPPORTED, PressableScale } from '../components/motion';
import { Avatar, Banner, Body, Caption, Chip, IconButton, LoadingView, Row, Screen, Text } from '../components/ui';
import { haptics } from '../haptics';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { offerEmailVerification } from '../utils/verification';
import type { ChatMessage } from '../types';
import type { RootStackParamList } from '../navigation/types';

/** Messages from one person closer together than this are drawn as one group. */
const GROUP_GAP_MS = 5 * 60 * 1000;

const STARTERS = ['Hi! Thanks for connecting 👋', 'When are you free this week?', 'Online or in person?'];

function senderOf(message: ChatMessage): string {
  return typeof message.sender === 'string' ? message.sender : message.sender._id;
}

function dayLabel(iso: string): string {
  const day = dayjs(iso);
  const today = dayjs();
  if (day.isSame(today, 'day')) return 'Today';
  if (day.isSame(today.subtract(1, 'day'), 'day')) return 'Yesterday';
  if (today.diff(day, 'day') < 7) return day.format('dddd');
  return day.format('D MMMM YYYY');
}

/** Three dots that rise and fall in turn: the partner is typing. */
function TypingBubble() {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={LAYOUT_ANIMATIONS_SUPPORTED ? FadeIn.duration(t.motion.fast) : undefined}
      accessibilityLabel="Typing"
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        gap: 5,
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: 20,
        borderBottomLeftRadius: 6,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginTop: t.spacing.sm,
      }}
    >
      {[0, 1, 2].map((i) => (
        <TypingDot key={i} index={i} still={reduceMotion} />
      ))}
    </Animated.View>
  );
}

function TypingDot({ index, still }: { index: number; still: boolean }) {
  const t = useTheme();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    lift.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
      ),
    );
  }, [index, lift, still]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + lift.value * 0.55,
    transform: [{ translateY: -lift.value * 4 }],
  }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.colors.textMuted }, style]} />;
}

/** The round send button. Springs up into view once there is something to send. */
function SendButton({ active, sending, onPress }: { active: boolean; sending: boolean; onPress(): void }) {
  const t = useTheme();
  const scale = useSharedValue(active ? 1 : 0.86);
  useEffect(() => {
    scale.value = withSpring(active ? 1 : 0.86, t.motion.springs.bouncy);
  }, [active, scale, t.motion.springs.bouncy]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      disabled={!active || sending}
      accessibilityRole="button"
      accessibilityLabel="Send message"
      accessibilityState={{ disabled: !active || sending }}
    >
      <Animated.View
        style={[
          {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: active ? t.colors.primary : t.colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        {sending ? (
          <ActivityIndicator size="small" color={t.colors.onPrimary} />
        ) : (
          <Ionicons name="arrow-up" size={22} color={active ? t.colors.onPrimary : t.colors.textMuted} />
        )}
      </Animated.View>
    </Pressable>
  );
}

export function ChatScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { conversationId, partnerName, partnerId } = useRoute<RouteProp<RootStackParamList, 'Chat'>>().params;
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
  const input = useRef<TextInput>(null);
  const firstName = partnerName.split(' ')[0] ?? partnerName;

  // The header is the person: avatar and name, with their typing state under it.
  useEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'left',
      headerTitle: () => (
        <PressableScale
          onPress={() => navigation.navigate('StudentProfile', { userId: partnerId })}
          accessibilityLabel={`View ${partnerName}'s profile`}
          scaleTo={0.96}
        >
          <Row gap={10}>
            <Avatar name={partnerName} size={34} />
            <View>
              <Text numberOfLines={1} style={{ fontSize: 16, lineHeight: 20, fontWeight: '700', color: t.colors.text }}>
                {partnerName}
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 16, color: partnerTyping ? t.colors.primary : t.colors.textMuted }}>
                {partnerTyping ? 'typing…' : 'Tap for profile'}
              </Text>
            </View>
          </Row>
        </PressableScale>
      ),
      headerRight: () => (
        <IconButton
          icon="calendar-outline"
          tone="plain"
          accessibilityLabel="Schedule a session"
          onPress={() => navigation.navigate('ScheduleSession', { partnerId, partnerName })}
        />
      ),
    });
  }, [navigation, partnerName, partnerId, partnerTyping, t.colors]);

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
        if (senderOf(incoming) !== user?.id) haptics.messageReceived();
        return [incoming, ...prev];
      });
      setPartnerTyping(false);
      // Reading it as it arrives keeps the unread badge honest.
      void chat.markRead(conversationId).catch(() => undefined);
    });

    const offTyping = onEvent<{ conversationId: string; userId: string; isTyping: boolean }>(RT.TYPING, (payload) => {
      if (payload.conversationId !== conversationId || payload.userId === user?.id) return;
      setPartnerTyping(payload.isTyping);
    });

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

  async function send(text = draft) {
    const body = text.trim();
    if (!body || sending) return;

    // Felt on the tap, not when the server answers: the message has left your hands.
    haptics.messageSent();
    setSending(true);
    setDraft('');
    emitTyping(conversationId, false);

    try {
      const message = await chat.send(conversationId, { body, type: 'TEXT' });
      setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [message, ...prev]));
    } catch (err) {
      haptics.error();
      setError(err instanceof Error ? err.message : 'Message could not be sent');
      offerEmailVerification(err);
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

  const spring = t.motion.springs.spatial;

  return (
    <Screen padded={false} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        {error ? (
          <View style={{ paddingHorizontal: t.spacing.page, paddingTop: t.spacing.md }}>
            <Banner tone="danger" text={error} />
          </View>
        ) : null}

        {messages.length === 0 ? (
          // Nothing said yet: a friendly opening and a few ways to start, so the first
          // message is one tap instead of a blank box.
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl }}>
            <Avatar name={partnerName} size={84} />
            <Text style={[t.typography.heading, { color: t.colors.text, marginTop: t.spacing.md }]}>
              Say hello to {firstName}
            </Text>
            <Body muted small style={{ textAlign: 'center', marginTop: 4, maxWidth: 280 }}>
              You are connected. Plan a time to meet, or just introduce yourself.
            </Body>
            <View style={{ gap: t.spacing.sm, marginTop: t.spacing.xl, alignItems: 'center' }}>
              {STARTERS.map((line) => (
                <Chip key={line} label={line} onPress={() => void send(line)} />
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item._id}
            // Newest at the bottom: the list renders reversed so new messages appear
            // without any manual scrolling.
            inverted
            contentContainerStyle={{ paddingHorizontal: t.spacing.page, paddingVertical: t.spacing.md }}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            ListHeaderComponent={partnerTyping ? <TypingBubble /> : null}
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={t.colors.primary} style={{ margin: 12 }} /> : null
            }
            renderItem={({ item, index }) => {
              const mine = senderOf(item) === user?.id;
              // The list is inverted: index - 1 is the next newer message, index + 1 the older.
              const newer = messages[index - 1];
              const older = messages[index + 1];
              const sameAsNewer =
                newer !== undefined &&
                senderOf(newer) === senderOf(item) &&
                dayjs(newer.createdAt).diff(item.createdAt) < GROUP_GAP_MS;
              const sameAsOlder =
                older !== undefined &&
                senderOf(older) === senderOf(item) &&
                dayjs(item.createdAt).diff(older.createdAt) < GROUP_GAP_MS;
              const newDay = !older || !dayjs(older.createdAt).isSame(item.createdAt, 'day');
              const lastInGroup = !sameAsNewer;
              const joinedAbove = sameAsOlder && !newDay;
              const big = t.radius.lg;
              const small = 6;

              return (
                <View style={{ marginTop: joinedAbove ? 3 : t.spacing.md }}>
                  {newDay ? (
                    <View style={{ alignItems: 'center', marginBottom: t.spacing.md }}>
                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 16,
                          fontWeight: '700',
                          color: t.colors.textMuted,
                          backgroundColor: t.colors.surfaceAlt,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 10,
                          overflow: 'hidden',
                        }}
                      >
                        {dayLabel(item.createdAt)}
                      </Text>
                    </View>
                  ) : null}
                  <Animated.View
                    // Bubbles slide in from the side they belong to, so a new message
                    // reads as arriving rather than simply appearing.
                    entering={
                      LAYOUT_ANIMATIONS_SUPPORTED
                        ? (mine ? SlideInRight : SlideInLeft).springify().damping(spring.damping).stiffness(spring.stiffness)
                        : undefined
                    }
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      backgroundColor: mine ? t.colors.primary : t.colors.surface,
                      borderRadius: big,
                      // The corner nearest the sender tightens inside a group, so a run of
                      // messages reads as one block with a single tail at the end.
                      borderTopRightRadius: mine && joinedAbove ? small : big,
                      borderBottomRightRadius: mine ? small : big,
                      borderTopLeftRadius: !mine && joinedAbove ? small : big,
                      borderBottomLeftRadius: mine ? big : small,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderWidth: mine ? 0 : 1,
                      borderColor: t.colors.border,
                    }}
                  >
                    <Body style={{ color: mine ? t.colors.onPrimary : t.colors.text }}>{item.body}</Body>
                  </Animated.View>
                  {lastInGroup ? (
                    <Row gap={4} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: 4, marginHorizontal: 4 }}>
                      <Caption style={{ fontSize: 11.5 }}>{dayjs(item.createdAt).format('h:mm A')}</Caption>
                      {mine ? (
                        <Ionicons
                          name={item.readAt ? 'checkmark-done' : 'checkmark'}
                          size={14}
                          color={item.readAt ? t.colors.primary : t.colors.textMuted}
                          accessibilityLabel={item.readAt ? 'Read' : 'Sent'}
                        />
                      ) : null}
                    </Row>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: t.spacing.sm,
            paddingHorizontal: t.spacing.md,
            paddingVertical: t.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
            backgroundColor: t.colors.bgElevated,
          }}
        >
          <View
            style={{
              flex: 1,
              minHeight: 44,
              justifyContent: 'center',
              backgroundColor: t.colors.surfaceAlt,
              borderRadius: 22,
              paddingHorizontal: 16,
            }}
          >
            <TextInput
              ref={input}
              value={draft}
              onChangeText={onChangeDraft}
              placeholder={`Message ${firstName}`}
              placeholderTextColor={t.colors.textMuted}
              selectionColor={t.colors.primary}
              multiline
              maxLength={4000}
              accessibilityLabel="Message"
              style={{
                fontFamily: t.fonts.regular,
                fontSize: 16,
                lineHeight: 21,
                color: t.colors.text,
                maxHeight: 120,
                paddingTop: Platform.OS === 'ios' ? 12 : 8,
                paddingBottom: Platform.OS === 'ios' ? 12 : 8,
              }}
            />
          </View>
          <SendButton active={draft.trim().length > 0} sending={sending} onPress={() => void send()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
