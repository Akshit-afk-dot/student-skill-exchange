import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import {
  Avatar,
  Body,
  Caption,
  Card,
  Chip,
  Heading,
  Row,
  StarRating,
} from './ui';
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
}: {
  student: SearchResultUser;
  onPress(): void;
}) {
  const t = useTheme();
  return (
    <Card onPress={onPress} style={{ marginBottom: t.spacing.md }}>
      <Row gap={t.spacing.md} style={{ alignItems: 'flex-start' }}>
        <Avatar name={student.name} uri={student.profileImage} online={student.isOnline} />
        <View style={{ flex: 1, gap: 3 }}>
          <Heading numberOfLines={1}>{student.name}</Heading>
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
                <Ionicons name="location-outline" size={13} color={t.colors.textMuted} />
                <Caption>{student.distanceKm.toFixed(1)} km</Caption>
              </Row>
            ) : null}
          </Row>

          {student.matchedSkillLevel ? (
            <Row style={{ marginTop: 6 }}>
              <Chip label={`Teaches at ${LEVEL_LABEL[student.matchedSkillLevel]}`} tone="primary" />
            </Row>
          ) : null}
        </View>
      </Row>
    </Card>
  );
}

export function MatchCard({
  match,
  onPress,
  onRequest,
}: {
  match: MatchCandidate;
  onPress(): void;
  onRequest?(): void;
}) {
  const t = useTheme();

  // Reason strings need skill names; the match payload already carries them.
  const skillNames = new Map<string, string>();
  for (const s of match.theyTeachYouWant) skillNames.set(s.id, s.name);
  for (const s of match.youTeachTheyWant) skillNames.set(s.id, s.name);

  const topReasons = match.reasons
    .map((r) => reasonText(r, skillNames))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <Card onPress={onPress} style={{ marginBottom: t.spacing.md }}>
      <Row gap={t.spacing.md} style={{ alignItems: 'flex-start' }}>
        <Avatar name={match.name} uri={match.profileImage} online={match.isOnline} size={48} />

        <View style={{ flex: 1 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Heading numberOfLines={1} style={{ flex: 1 }}>
              {match.name}
            </Heading>
            <View
              style={{
                backgroundColor: match.twoWay ? t.colors.successSoft : t.colors.primarySoft,
                paddingHorizontal: 9,
                paddingVertical: 3,
                borderRadius: t.radius.pill,
              }}
            >
              <Caption
                style={{
                  color: match.twoWay ? t.colors.success : t.colors.primary,
                  fontWeight: '700',
                }}
              >
                {match.matchPercent}% match
              </Caption>
            </View>
          </Row>

          {match.college ? <Caption numberOfLines={1}>{match.college}</Caption> : null}

          {match.twoWay ? (
            <Row style={{ marginTop: 8 }}>
              <Chip label="Two-way exchange" tone="success" icon="swap-horizontal" />
            </Row>
          ) : null}

          {match.theyTeachYouWant.length > 0 ? (
            <View style={{ marginTop: 10 }}>
              <Caption style={{ marginBottom: 4 }}>They can teach you</Caption>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {match.theyTeachYouWant.slice(0, 3).map((s) => (
                  <Chip key={s.id} label={s.name} tone="primary" />
                ))}
              </Row>
            </View>
          ) : null}

          {match.youTeachTheyWant.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <Caption style={{ marginBottom: 4 }}>You can teach them</Caption>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {match.youTeachTheyWant.slice(0, 3).map((s) => (
                  <Chip key={s.id} label={s.name} />
                ))}
              </Row>
            </View>
          ) : null}

          {topReasons.length > 0 ? (
            <View style={{ marginTop: 10, gap: 3 }}>
              {topReasons.map((reason) => (
                <Row key={reason} gap={6}>
                  <Ionicons name="checkmark-circle" size={13} color={t.colors.success} />
                  <Caption style={{ flex: 1 }}>{reason}</Caption>
                </Row>
              ))}
            </View>
          ) : null}

          {onRequest ? (
            <Row style={{ marginTop: t.spacing.md }}>
              <Chip label="Send a request" tone="primary" icon="paper-plane-outline" onPress={onRequest} />
            </Row>
          ) : null}
        </View>
      </Row>
    </Card>
  );
}

export function SessionCard({
  session,
  currentUserId,
  onPress,
}: {
  session: LearningSession;
  currentUserId: string;
  onPress(): void;
}) {
  const t = useTheme();
  const isTeacher = session.teacher._id === currentUserId;
  const partner = isTeacher ? session.learner : session.teacher;

  return (
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

      <Row gap={t.spacing.md} style={{ marginTop: t.spacing.md }}>
        <Row gap={5}>
          <Ionicons name="time-outline" size={14} color={t.colors.textMuted} />
          <Caption>{formatSessionWhen(session.scheduledAt)}</Caption>
        </Row>
        <Row gap={5}>
          <Ionicons name="hourglass-outline" size={14} color={t.colors.textMuted} />
          <Caption>{formatDuration(session.durationMinutes)}</Caption>
        </Row>
      </Row>
    </Card>
  );
}

export function CalendarEntryCard({
  entry,
  onPress,
}: {
  entry: CalendarEntry;
  onPress(): void;
}) {
  const t = useTheme();
  return (
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
  );
}

export function RequestCard({
  request,
  direction,
  onPress,
  actions,
}: {
  request: LearningRequest;
  direction: 'incoming' | 'outgoing';
  onPress(): void;
  actions?: React.ReactNode;
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
    <Card style={{ marginBottom: t.spacing.md }}>
      <Row gap={t.spacing.md} style={{ alignItems: 'flex-start' }}>
        <Avatar name={other.name} uri={other.profileImage} />
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
              <Chip label={`Offers ${request.offeredSkill.name}`} tone="success" />
            ) : null}
          </Row>

          <Body small muted style={{ marginTop: t.spacing.sm }} numberOfLines={3}>
            {request.message}
          </Body>

          {actions ? <View style={{ marginTop: t.spacing.md }}>{actions}</View> : null}

          <Pressable onPress={onPress} hitSlop={6} style={{ marginTop: t.spacing.sm }}>
            <Caption style={{ color: t.colors.primary, fontWeight: '600' }}>View profile</Caption>
          </Pressable>
        </View>
      </Row>
    </Card>
  );
}
