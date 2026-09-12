import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import {
  Avatar,
  Body,
  Caption,
  Card,
  Chip,
  Heading,
  Overline,
  Row,
  StarRating,
} from './ui';
import { AnimatedListItem, PressableScale } from './motion';
import { ScoreRing } from './ScoreRing';
import { useTheme } from '../theme';
import {
  LEVEL_LABEL,
  formatDuration,
  formatSessionWhen,
  reasonText,
  statusLabel,
  statusTone,
} from '../utils/format';
import type {
  CalendarEntry,
  LearningRequest,
  LearningSession,
  MatchCandidate,
  SearchResultUser,
} from '../types';

export function StudentCard({
  student,
  onPress,
  index = 0,
}: {
  student: SearchResultUser;
  onPress(): void;
  index?: number;
}) {
  const t = useTheme();
  return (
    <AnimatedListItem index={index}>
      <Card onPress={onPress} style={{ marginBottom: t.spacing.md }}>
        <Row gap={t.spacing.md} style={{ alignItems: 'flex-start' }}>
          <Avatar name={student.name} uri={student.profileImage} online={student.isOnline} size={48} />
          <View style={{ flex: 1, gap: 3 }}>
            <Heading numberOfLines={1}>{student.name}</Heading>
            {student.college ? (
              <Caption numberOfLines={1}>
                {student.college}
                {student.department ? ` · ${student.department}` : ''}
              </Caption>
            ) : null}

            <Row gap={t.spacing.md} style={{ marginTop: 5 }}>
              <StarRating value={student.rating.average} count={student.rating.count} />
              {student.distanceKm !== undefined ? (
                <Row gap={3}>
                  <Ionicons name="location-outline" size={13} color={t.colors.textMuted} />
                  <Caption>{student.distanceKm.toFixed(1)} km</Caption>
                </Row>
              ) : null}
            </Row>

            {student.matchedSkillLevel ? (
              <Row style={{ marginTop: 8 }}>
                <Chip label={`Teaches at ${LEVEL_LABEL[student.matchedSkillLevel]}`} tone="primary" />
              </Row>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} />
        </Row>
      </Card>
    </AnimatedListItem>
  );
}

/**
 * The match card. Leads with the animated score ring, because the score is the thing
 * the whole system exists to produce and it should read before any of the detail.
 */
export function MatchCard({
  match,
  onPress,
  onRequest,
  index = 0,
}: {
  match: MatchCandidate;
  onPress(): void;
  onRequest?(): void;
  index?: number;
}) {
  const t = useTheme();

  const skillNames = new Map<string, string>();
  for (const s of match.theyTeachYouWant) skillNames.set(s.id, s.name);
  for (const s of match.youTeachTheyWant) skillNames.set(s.id, s.name);

  const topReasons = match.reasons
    .map((r) => reasonText(r, skillNames))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <AnimatedListItem index={index}>
      {/* The card is NOT pressable as a whole: it contains its own action button, and
          nesting pressables makes a tap ambiguous — "Send a request" would also fire
          the card's navigation. Instead the informational region is the tap target and
          the button sits beside it. */}
      <Card
        elevated={match.twoWay ? 2 : 1}
        style={{
          marginBottom: t.spacing.md,
          padding: 0,
          overflow: 'hidden',
          // A reciprocal match earns a coloured edge — the one thing worth spotting
          // while scrolling.
          borderColor: match.twoWay ? t.colors.success : t.colors.border,
          borderWidth: match.twoWay ? 1.4 : undefined,
        }}
      >
        {match.twoWay ? (
          <LinearGradient
            colors={t.gradients.success}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 6, paddingHorizontal: t.spacing.lg }}
          >
            <Row gap={6}>
              <Ionicons name="swap-horizontal" size={14} color="#fff" />
              <Caption style={{ color: '#fff', fontWeight: '700' }}>
                Two-way exchange — you can each teach the other
              </Caption>
            </Row>
          </LinearGradient>
        ) : null}

        <PressableScale
          onPress={onPress}
          haptic="tap"
          scaleTo={0.99}
          accessibilityLabel={`View ${match.name}'s profile`}
          style={{ padding: t.spacing.lg, paddingBottom: onRequest ? 0 : t.spacing.lg }}
        >
          <Row gap={t.spacing.md} style={{ alignItems: 'center' }}>
            <Avatar name={match.name} uri={match.profileImage} online={match.isOnline} size={52} />

            <View style={{ flex: 1 }}>
              <Heading numberOfLines={1}>{match.name}</Heading>
              {match.college ? <Caption numberOfLines={1}>{match.college}</Caption> : null}
              <Row gap={t.spacing.md} style={{ marginTop: 4 }}>
                <StarRating value={match.rating.average} count={match.rating.count} />
                {match.distanceKm !== undefined ? (
                  <Caption>{match.distanceKm.toFixed(1)} km</Caption>
                ) : null}
              </Row>
            </View>

            <ScoreRing
              percent={match.matchPercent}
              size={64}
              twoWay={match.twoWay}
              delay={index * 60}
            />
          </Row>

          {match.theyTeachYouWant.length > 0 ? (
            <View style={{ marginTop: t.spacing.lg }}>
              <Overline style={{ marginBottom: 6 }}>They can teach you</Overline>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {match.theyTeachYouWant.slice(0, 3).map((s) => (
                  <Chip key={s.id} label={s.name} tone="primary" />
                ))}
              </Row>
            </View>
          ) : null}

          {match.youTeachTheyWant.length > 0 ? (
            <View style={{ marginTop: t.spacing.md }}>
              <Overline style={{ marginBottom: 6 }}>You can teach them</Overline>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {match.youTeachTheyWant.slice(0, 3).map((s) => (
                  <Chip key={s.id} label={s.name} tone="accent" />
                ))}
              </Row>
            </View>
          ) : null}

          {topReasons.length > 0 ? (
            <View style={{ marginTop: t.spacing.lg, gap: 5 }}>
              {topReasons.map((reason) => (
                <Row key={reason} gap={7}>
                  <Ionicons name="checkmark-circle" size={14} color={t.colors.success} />
                  <Caption style={{ flex: 1, lineHeight: 17 }}>{reason}</Caption>
                </Row>
              ))}
            </View>
          ) : null}

        </PressableScale>

        {onRequest ? (
          <PressableScale
            onPress={onRequest}
            haptic="press"
            style={{ margin: t.spacing.lg, marginTop: t.spacing.md }}
            accessibilityLabel={`Send a learning request to ${match.name}`}
          >
            <LinearGradient
              colors={t.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                paddingVertical: 12,
                borderRadius: t.radius.md,
              }}
            >
              <Ionicons name="paper-plane-outline" size={15} color="#fff" />
              <Body small style={{ color: '#fff', fontWeight: '600' }}>
                Send a request
              </Body>
            </LinearGradient>
          </PressableScale>
        ) : null}
      </Card>
    </AnimatedListItem>
  );
}

export function SessionCard({
  session,
  currentUserId,
  onPress,
  index = 0,
}: {
  session: LearningSession;
  currentUserId: string;
  onPress(): void;
  index?: number;
}) {
  const t = useTheme();
  const isTeacher = session.teacher._id === currentUserId;
  const partner = isTeacher ? session.learner : session.teacher;

  return (
    <AnimatedListItem index={index}>
      <Card onPress={onPress} style={{ marginBottom: t.spacing.md }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: t.spacing.sm }}>
          <Chip label={statusLabel(session.status)} tone={statusTone(session.status)} />
          <Chip
            label={session.mode === 'ONLINE' ? 'Online' : 'In person'}
            icon={session.mode === 'ONLINE' ? 'videocam-outline' : 'location-outline'}
          />
        </Row>

        <Heading numberOfLines={1}>{session.skill?.name ?? 'Session'}</Heading>

        <Row gap={t.spacing.sm} style={{ marginTop: t.spacing.sm }}>
          <Avatar name={partner.name} uri={partner.profileImage} size={28} />
          <Body small muted style={{ flex: 1 }} numberOfLines={1}>
            {isTeacher ? 'Teaching' : 'Learning from'} {partner.name}
          </Body>
        </Row>

        <Row
          gap={t.spacing.md}
          style={{
            marginTop: t.spacing.md,
            paddingTop: t.spacing.md,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
          }}
        >
          <Row gap={5}>
            <Ionicons name="time-outline" size={14} color={t.colors.primary} />
            <Caption>{formatSessionWhen(session.scheduledAt)}</Caption>
          </Row>
          <Row gap={5}>
            <Ionicons name="hourglass-outline" size={14} color={t.colors.textMuted} />
            <Caption>{formatDuration(session.durationMinutes)}</Caption>
          </Row>
        </Row>
      </Card>
    </AnimatedListItem>
  );
}

export function CalendarEntryCard({
  entry,
  onPress,
  index = 0,
}: {
  entry: CalendarEntry;
  onPress(): void;
  index?: number;
}) {
  const t = useTheme();
  return (
    <AnimatedListItem index={index}>
      <Card onPress={onPress} style={{ marginBottom: t.spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Body numberOfLines={1}>{entry.title}</Body>
            <Caption style={{ marginTop: 3 }}>
              {formatSessionWhen(entry.scheduledAt)} · {formatDuration(entry.durationMinutes)}
            </Caption>
          </View>
          <Chip label={statusLabel(entry.status)} tone={statusTone(entry.status)} />
        </Row>
      </Card>
    </AnimatedListItem>
  );
}

export function RequestCard({
  request,
  direction,
  onPress,
  actions,
  index = 0,
}: {
  request: LearningRequest;
  direction: 'incoming' | 'outgoing';
  onPress(): void;
  actions?: React.ReactNode;
  index?: number;
}) {
  const t = useTheme();
  const other = direction === 'incoming' ? request.sender : request.receiver;

  const tone =
    request.status === 'ACCEPTED'
      ? 'success'
      : request.status === 'PENDING'
        ? 'warning'
        : 'neutral';

  return (
    <AnimatedListItem index={index}>
      <Card style={{ marginBottom: t.spacing.md }}>
        <Row gap={t.spacing.md} style={{ alignItems: 'flex-start' }}>
          <Avatar name={other.name} uri={other.profileImage} size={48} />
          <View style={{ flex: 1 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Heading numberOfLines={1} style={{ flex: 1 }}>
                {other.name}
              </Heading>
              <Chip label={statusLabel(request.status)} tone={tone} />
            </Row>

            {other.college ? <Caption numberOfLines={1}>{other.college}</Caption> : null}

            <Row gap={6} style={{ marginTop: t.spacing.sm, flexWrap: 'wrap' }}>
              <Chip
                label={`${direction === 'incoming' ? 'Wants to learn' : 'You want to learn'} ${request.skill.name}`}
                tone="primary"
              />
              {request.offeredSkill ? (
                <Chip label={`Offers ${request.offeredSkill.name}`} tone="success" icon="swap-horizontal" />
              ) : null}
            </Row>

            <View
              style={{
                marginTop: t.spacing.md,
                padding: t.spacing.md,
                backgroundColor: t.colors.surfaceAlt,
                borderRadius: t.radius.md,
              }}
            >
              <Body small numberOfLines={4} style={{ lineHeight: 19 }}>
                {request.message}
              </Body>
            </View>

            {actions ? <View style={{ marginTop: t.spacing.md }}>{actions}</View> : null}

            <PressableScale onPress={onPress} haptic="tap" style={{ marginTop: t.spacing.sm }}>
              <Caption style={{ color: t.colors.primary, fontWeight: '600' }}>View profile</Caption>
            </PressableScale>
          </View>
        </Row>
      </Card>
    </AnimatedListItem>
  );
}
