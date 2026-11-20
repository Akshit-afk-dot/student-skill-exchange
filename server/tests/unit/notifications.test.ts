import { describe, expect, it } from 'vitest';
import {
  clip,
  firstName,
  formatTime,
  formatWhen,
  sessionPlace,
  startsIn,
  stars,
} from '../../src/modules/notifications/format';
import { DELIVERY, EXPO_PUSH_TOKEN, buildMessage } from '../../src/modules/notifications/push';
import { NOTIFICATION_CATEGORY, NOTIFICATION_TYPES } from '../../src/types/domain';

const TOKEN = 'ExponentPushToken[abcdefghijklmnopqrstuv]';

describe('notification times', () => {
  // 11:30 UTC is 5:00 pm in India and 6:30 am in New York.
  const at = new Date('2026-11-20T11:30:00Z');
  const now = new Date('2026-11-18T09:00:00Z');

  it('writes the time in the reader’s own zone, not the server’s', () => {
    expect(formatWhen(at, 'Asia/Kolkata', now)).toBe('Fri 20 Nov, 5:00 pm');
    expect(formatWhen(at, 'America/New_York', now)).toBe('Fri 20 Nov, 6:30 am');
  });

  it('adds the year only when it is not this year', () => {
    expect(formatWhen(new Date('2027-01-04T05:00:00Z'), 'Asia/Kolkata', now)).toBe('Mon 4 Jan 2027, 10:30 am');
  });

  it('falls back to the default zone rather than failing on a bad one', () => {
    expect(formatTime(at, 'Not/AZone')).toBe('5:00 pm');
  });

  it('says how soon in words a person would use', () => {
    expect(startsIn(58)).toBe('in about an hour');
    expect(startsIn(27)).toBe('in 25 minutes');
    expect(startsIn(7)).toBe('in 7 minutes');
    expect(startsIn(0.4)).toBe('now');
  });
});

describe('notification wording helpers', () => {
  it('clips quotes at a word, with an ellipsis', () => {
    expect(clip('short', 20)).toBe('short');
    const out = clip('Could you show me how to hold the pick properly and strum', 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });

  it('names a place briefly', () => {
    expect(sessionPlace('ONLINE', 'ignored')).toBe('Online');
    expect(sessionPlace('OFFLINE', 'Library, room 2')).toBe('At Library, room 2');
    expect(sessionPlace('OFFLINE', '  ')).toBe('In person');
  });

  it('draws ratings and first names', () => {
    expect(stars(4)).toBe('★★★★☆');
    expect(firstName('Priya Sharma')).toBe('Priya');
    expect(firstName('')).toBe('Someone');
  });
});

describe('push messages', () => {
  it('accepts Expo tokens and nothing else', () => {
    expect(EXPO_PUSH_TOKEN.test(TOKEN)).toBe(true);
    expect(EXPO_PUSH_TOKEN.test('ExpoPushToken[abcdefghijklmnop]')).toBe(true);
    expect(EXPO_PUSH_TOKEN.test('fcm-device-token-1234567890')).toBe(false);
    expect(EXPO_PUSH_TOKEN.test('ExponentPushToken[]')).toBe(false);
  });

  it('gives every notification type a delivery', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(DELIVERY[NOTIFICATION_CATEGORY[type]]).toBeDefined();
    }
  });

  it('routes a chat message through the messages channel, replacing by chat', () => {
    const message = buildMessage(
      TOKEN,
      {
        notificationId: 'n1',
        type: 'MESSAGE_RECEIVED',
        title: 'Priya Sharma',
        body: 'See you at 5?',
        data: { conversationId: 'c1', screen: 'Chat' },
        tag: 'chat:c1',
        threadId: 'chat:c1',
      },
      3,
    );
    expect(message).toMatchObject({
      to: TOKEN,
      title: 'Priya Sharma',
      channelId: 'messages',
      icon: 'notification_messages',
      priority: 'high',
      sound: 'default',
      badge: 3,
      tag: 'chat:c1',
      threadId: 'chat:c1',
      interruptionLevel: 'active',
    });
    expect(message.data).toEqual({ conversationId: 'c1', screen: 'Chat', type: 'MESSAGE_RECEIVED', notificationId: 'n1' });
    expect(message.collapseId).toBeUndefined();
    expect(message.ttl).toBeGreaterThan(0);
  });

  it('makes reminders time-sensitive and drops them once the session starts', () => {
    const startsAt = new Date('2026-11-20T11:30:00Z');
    const message = buildMessage(
      TOKEN,
      {
        notificationId: 'n2',
        type: 'SESSION_REMINDER',
        title: 'Guitar starts in 25 minutes',
        body: 'With Priya at 5:00 pm · Online',
        data: { sessionId: 's1' },
        collapseId: 'session:s1',
        expiresAt: startsAt,
      },
      1,
    );
    expect(message.channelId).toBe('reminders');
    expect(message.interruptionLevel).toBe('time-sensitive');
    expect(message.expiration).toBe(startsAt.getTime() / 1000);
    expect(message.ttl).toBeUndefined();
    // collapseId replaces on iOS; the same key becomes the Android tag.
    expect(message.collapseId).toBe('session:s1');
    expect(message.tag).toBe('session:s1');
  });

  it('keeps achievements quiet', () => {
    const message = buildMessage(
      TOKEN,
      { notificationId: 'n3', type: 'BADGE_EARNED', title: 'New badge: Polyglot', body: 'x', data: {} },
      0,
    );
    expect(message.channelId).toBe('achievements');
    expect(message.sound).toBeUndefined();
    expect(message.interruptionLevel).toBe('passive');
  });
});
