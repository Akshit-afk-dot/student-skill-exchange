import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { View } from 'react-native';
import { Button } from './Button';
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
  VerifiedName,
} from './ui';
import { AnimatedListItem, PressableScale } from './motion';
import { ScoreRing } from './ScoreRing';
import { Text } from './Text';
import { useTheme } from '../theme';
import {
  LEVEL_LABEL,
  formatDuration,
  formatSessionWhen,
  formatTime,
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

/** A labelled row of skill chips. Violet for skills taught, orange for skills learned. */
function SkillLine({
  label,
  tone,
  skills,
}: {
  label: string;
  tone: 'teach' | 'learn';
  skills: Array<{ id: string; name: string }>;
}) {
  if (skills.length === 0) return null;
  const extra = skills.length - 3;
  return (
    <View style={{ gap: 7 }}>
      <Overline>{label}</Overline>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {skills.slice(0, 3).map((s) => (
          <Chip key={s.id} label={s.name} tone={tone} icon={tone === 'teach' ? 'school' : 'book'} />
        ))}
        {extra > 0 ? <Chip label={`+${extra}`} /> : null}
      </Row>
    </View>
  );
}

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
      <Card
        onPress={onPress}
        style={{ marginBottom: t.spacing.md }}
        accessibilityLabel={`View ${student.name}'s profile`}
      >
        <Row gap={t.spacing.md}>
          <Avatar name={student.name} uri={student.profileImage} online={student.isOnline} size={54} />
          <View style={{ flex: 1, gap: 2 }}>
            <VerifiedName name={student.name} verified={student.verified} />
            {student.college ? (
              <Caption numberOfLines={1}>
                {student.college}
                {student.department ? ` · ${student.department}` : ''}
              </Caption>
            ) : null}

            <Row gap={t.spacing.md} style={{ marginTop: 4 }}>
              <StarRating value={student.rating.average} count={student.rating.count} />
              {student.distanceKm !== undefined ? (
                <Row gap={3}>
                  <Ionicons name="location-outline" size={13} color={t.colors.textSecondary} />
                  <Caption>{student.distanceKm.toFixed(1)} km</Caption>
                </Row>
              ) : null}
            </Row>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.colors.textSecondary} />
        </Row>

        {student.matchedSkillLevel ? (
          <Row style={{ marginTop: t.spacing.md }}>
            <Chip
              label={`Teaches at ${LEVEL_LABEL[student.matchedSkillLevel]} level`}
              tone="teach"
              icon="school-outline"
            />
          </Row>
        ) : null}
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

  // The two-way reason is already shown as the ribbon; repeating it wastes a line.
  const topReasons = match.reasons
    .filter((r) => r.code !== 'TWO_WAY_EXCHANGE')
    .map((r) => reasonText(r, skillNames))
    .filter(Boolean)
    .slice(0, 2);

  return (
    <AnimatedListItem index={index}>
      {/* The card is NOT pressable as a whole: it contains its own action button, and
          nesting pressables makes a tap ambiguous — "Send request" would also fire
          the card's navigation. Instead the informational region is the tap target and
          the button sits beside it. */}
      <Card
        elevated={match.twoWay ? 2 : 1}
        style={{
          marginBottom: t.spacing.lg,
          padding: 0,
          overflow: 'hidden',
          // A reciprocal match earns a coloured edge — the one thing worth spotting
          // while scrolling.
          borderColor: match.twoWay ? t.colors.success : t.colors.border,
          borderWidth: match.twoWay ? 1.5 : undefined,
        }}
      >
        {match.twoWay ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              backgroundColor: t.colors.successContainer,
              paddingVertical: 8,
              paddingHorizontal: t.spacing.lg,
            }}
          >
            <Ionicons name="swap-horizontal" size={15} color={t.colors.onSuccessContainer} />
            <Text style={{ color: t.colors.onSuccessContainer, fontSize: 13, lineHeight: 17, fontWeight: '700' }}>
              Two-way exchange
            </Text>
            <Text style={{ color: t.colors.onSuccessContainer, fontSize: 13, lineHeight: 17, flex: 1 }} numberOfLines={1}>
              You can each teach the other
            </Text>
          </View>
        ) : null}

        <PressableScale
          onPress={onPress}
          haptic="tap"
          scaleTo={0.99}
          accessibilityLabel={`View ${match.name}'s profile, ${match.matchPercent} percent match`}
          style={{ padding: t.spacing.lg, paddingBottom: onRequest ? t.spacing.md : t.spacing.lg, gap: t.spacing.lg }}
        >
          <Row gap={t.spacing.md}>
            <Avatar
              name={match.name}
              uri={match.profileImage}
              online={match.isOnline}
              size={56}
              {...(match.twoWay ? { ring: t.colors.success } : {})}
            />

            <View style={{ flex: 1, gap: 2 }}>
              <VerifiedName name={match.name} verified={match.verified} />
              {match.college ? <Caption numberOfLines={1}>{match.college}</Caption> : null}
              <Row gap={t.spacing.md} style={{ marginTop: 3 }}>
                <StarRating value={match.rating.average} count={match.rating.count} />
                {match.distanceKm !== undefined ? (
                  <Row gap={3}>
                    <Ionicons name="location-outline" size={13} color={t.colors.textSecondary} />
                    <Caption>{match.distanceKm.toFixed(1)} km</Caption>
                  </Row>
                ) : null}
              </Row>
            </View>

            <ScoreRing
              percent={match.matchPercent}
              size={66}
              label="match"
              twoWay={match.twoWay}
              delay={index * 60}
            />
          </Row>

          <SkillLine label="You learn" tone="learn" skills={match.theyTeachYouWant} />
          <SkillLine label="You teach" tone="teach" skills={match.youTeachTheyWant} />

          {topReasons.length > 0 ? (
            <View style={{ gap: 6 }}>
              {topReasons.map((reason) => (
                <Row key={reason} gap={8} style={{ alignItems: 'flex-start' }}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={t.colors.success}
                    style={{ marginTop: 1 }}
                  />
                  <Caption style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>{reason}</Caption>
                </Row>
              ))}
            </View>
          ) : null}
        </PressableScale>

        {onRequest ? (
          <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg }}>
            {/* Tonal, not raised: a screen of these cards must not be a wall of
                primary buttons all asking to be pressed first. */}
            <Button
              label="Send request"
              variant="tonal"
              size="md"
              icon="paper-plane"
              onPress={onRequest}
              accessibilityLabel={`Send a learning request to ${match.name}`}
            />
          </View>
        ) : null}
      </Card>
    </AnimatedListItem>
  );
}

/** A calendar-page tile: weekday, day of month, month. Reads faster than a date string. */
function DateTile({ iso, muted = false }: { iso: string; muted?: boolean }) {
  const t = useTheme();
  const when = dayjs(iso);
  return (
    <View
      style={{
        width: 56,
        borderRadius: t.radius.md,
        backgroundColor: muted ? t.colors.surfaceContainer : t.colors.primaryContainer,
        alignItems: 'center',
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          color: muted ? t.colors.textSecondary : t.colors.onPrimaryContainer,
          fontSize: 11.5,
          lineHeight: 15,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {when.format('ddd')}
      </Text>
      <Text
        style={{
          color: t.colors.textPrimary,
          fontSize: 22,
          lineHeight: 27,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
        }}
      >
        {when.format('D')}
      </Text>
      <Text style={{ color: t.colors.textSecondary, fontSize: 11.5, lineHeight: 15, fontWeight: '600' }}>
        {when.format('MMM')}
      </Text>
    </View>
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
  const over = session.status === 'CANCELLED' || session.status === 'COMPLETED' || session.status === 'NO_SHOW';

  return (
    <AnimatedListItem index={index}>
      <Card
        onPress={onPress}
        style={{ marginBottom: t.spacing.md }}
        accessibilityLabel={`${session.skill?.name ?? 'Session'} with ${partner.name}, ${formatSessionWhen(session.scheduledAt)}`}
      >
        <Row gap={t.spacing.md} style={{ alignItems: 'flex-start' }}>
          <DateTile iso={session.scheduledAt} muted={over} />

          <View style={{ flex: 1, gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Chip
                label={isTeacher ? 'You teach' : 'You learn'}
                tone={isTeacher ? 'teach' : 'learn'}
              />
              <Chip label={statusLabel(session.status)} tone={statusTone(session.status)} />
            </Row>

            <Heading numberOfLines={1} style={{ marginTop: 4 }}>
              {session.skill?.name ?? 'Session'}
            </Heading>

            <Row gap={t.spacing.sm}>
              <Avatar name={partner.name} uri={partner.profileImage} size={22} />
              <Body small muted style={{ flex: 1 }} numberOfLines={1}>
                with {partner.name}
              </Body>
            </Row>

            <Row gap={t.spacing.md} style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <Row gap={4}>
                <Ionicons name="time-outline" size={14} color={t.colors.textSecondary} />
                <Caption>
                  {formatTime(session.scheduledAt)} · {formatDuration(session.durationMinutes)}
                </Caption>
              </Row>
              <Row gap={4}>
                <Ionicons
                  name={session.mode === 'ONLINE' ? 'videocam-outline' : 'location-outline'}
                  size={14}
                  color={t.colors.textSecondary}
                />
                <Caption>{session.mode === 'ONLINE' ? 'Online' : 'In person'}</Caption>
              </Row>
            </Row>
          </View>
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
        <Row style={{ justifyContent: 'space-between' }} gap={t.spacing.md}>
          <View style={{ flex: 1 }}>
            <Body numberOfLines={1} style={{ fontWeight: '600' }}>
              {entry.title}
            </Body>
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
  const incoming = direction === 'incoming';
  const other = incoming ? request.sender : request.receiver;

  const tone =
    request.status === 'ACCEPTED'
      ? 'success'
      : request.status === 'PENDING'
        ? 'warning'
        : 'neutral';

  return (
    <AnimatedListItem index={index}>
      <Card style={{ marginBottom: t.spacing.md, gap: t.spacing.md }}>
        {/* The person is the tap target; the action buttons below are separate. */}
        <PressableScale
          onPress={onPress}
          haptic="tap"
          scaleTo={0.99}
          accessibilityLabel={`View ${other.name}'s profile`}
        >
          <Row gap={t.spacing.md}>
            <Avatar name={other.name} uri={other.profileImage} online={other.isOnline} size={50} />
            <View style={{ flex: 1 }}>
              <Heading numberOfLines={1}>{other.name}</Heading>
              {other.college ? <Caption numberOfLines={1}>{other.college}</Caption> : null}
            </View>
            <Chip label={statusLabel(request.status)} tone={tone} />
          </Row>
        </PressableScale>

        {/* From the reader's side: what they would teach is violet, what they would
            learn is orange, whichever direction the request travelled. */}
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Chip
            label={`${incoming ? 'You teach' : 'You learn'} ${request.skill.name}`}
            tone={incoming ? 'teach' : 'learn'}
            icon={incoming ? 'school-outline' : 'book-outline'}
          />
          {request.offeredSkill ? (
            <Chip
              label={`${incoming ? 'You learn' : 'You teach'} ${request.offeredSkill.name}`}
              tone={incoming ? 'learn' : 'teach'}
              icon={incoming ? 'book-outline' : 'school-outline'}
            />
          ) : null}
        </Row>

        <View
          style={{
            padding: t.spacing.md,
            backgroundColor: t.colors.surfaceContainer,
            borderRadius: t.radius.md,
            borderTopLeftRadius: 4,
          }}
        >
          <Body small numberOfLines={4}>
            {request.message}
          </Body>
        </View>

        {actions ? <View>{actions}</View> : null}
      </Card>
    </AnimatedListItem>
  );
}

/** Width of a `MatchPeek`, exported so a carousel can snap to it. */
export const MATCH_PEEK_WIDTH = 236;

/**
 * A compact match for a horizontal row: who, how well you fit, and the one skill you
 * would learn from them. The whole card opens the profile, where the full case is made.
 */
export function MatchPeek({
  match,
  onPress,
  index = 0,
}: {
  match: MatchCandidate;
  onPress(): void;
  index?: number;
}) {
  const t = useTheme();
  const learn = match.theyTeachYouWant[0];
  const teach = match.youTeachTheyWant[0];

  return (
    <AnimatedListItem index={index}>
      <Card
        onPress={onPress}
        elevated={2}
        accessibilityLabel={`${match.name}, ${match.matchPercent} percent match${match.twoWay ? ', two-way exchange' : ''}`}
        style={{
          width: MATCH_PEEK_WIDTH,
          gap: t.spacing.md,
          borderColor: match.twoWay ? t.colors.success : t.colors.border,
          borderWidth: match.twoWay ? 1.5 : undefined,
        }}
      >
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Avatar
            name={match.name}
            uri={match.profileImage}
            online={match.isOnline}
            size={52}
            {...(match.twoWay ? { ring: t.colors.success } : {})}
          />
          <ScoreRing percent={match.matchPercent} size={54} twoWay={match.twoWay} delay={200 + index * 80} />
        </Row>

        <View style={{ gap: 1 }}>
          <VerifiedName name={match.name} verified={match.verified} />
          <Caption numberOfLines={1}>{match.college ?? 'Student'}</Caption>
        </View>

        <View style={{ gap: 6 }}>
          {learn ? (
            <Row gap={6}>
              <Ionicons name="book" size={14} color={t.colors.tertiary} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: t.colors.textPrimary }}>
                <Text style={{ fontWeight: '700', color: t.colors.tertiary }}>Learn </Text>
                {learn.name}
              </Text>
            </Row>
          ) : null}
          {teach ? (
            <Row gap={6}>
              <Ionicons name="school" size={14} color={t.colors.primary} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: t.colors.textPrimary }}>
                <Text style={{ fontWeight: '700', color: t.colors.primary }}>Teach </Text>
                {teach.name}
              </Text>
            </Row>
          ) : null}
        </View>
      </Card>
    </AnimatedListItem>
  );
}
