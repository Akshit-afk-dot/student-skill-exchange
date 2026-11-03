import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { requests, skills as skillsApi, users as usersApi } from '../api/endpoints';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Field,
  Input,
  LoadingView,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { useAction, useAsync } from '../hooks/useAsync';
import { useTheme } from '../theme';
import { offerEmailVerification } from '../utils/verification';
import type { RootStackParamList } from '../navigation/types';

/**
 * Composes a learning request.
 *
 * Only skills the recipient actually teaches are offerable, and only skills the sender
 * teaches can be offered back — the same rules the API enforces, surfaced as a picker
 * so the student cannot compose a request that will be rejected.
 */
export function SendRequestScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId, userName, skillId } = useRoute<RouteProp<RootStackParamList, 'SendRequest'>>().params;

  const [wantSkillId, setWantSkillId] = useState<string | null>(skillId ?? null);
  const [offerSkillId, setOfferSkillId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(
    async () => Promise.all([usersApi.profile(userId), skillsApi.mine()]),
    [userId],
  );
  const state = useAsync(load, [userId]);

  const theirTeaches = state.data?.[0]?.teaches ?? [];
  const myTeaches = state.data?.[1]?.teaches ?? [];

  // Pre-select the only option rather than making the student tap it.
  useEffect(() => {
    if (!wantSkillId && theirTeaches.length === 1) {
      setWantSkillId(theirTeaches[0]?.skill.id ?? null);
    }
  }, [theirTeaches, wantSkillId]);

  // Draft a sensible opening line once both sides are known.
  useEffect(() => {
    if (message) return;
    const want = theirTeaches.find((s) => s.skill.id === wantSkillId)?.skill.name;
    const offer = myTeaches.find((s) => s.skill._id === offerSkillId)?.skill.name;
    if (!want) return;
    setMessage(
      offer
        ? `Hi ${userName.split(' ')[0]}! I noticed you teach ${want}. I would love to learn it, and I can teach you ${offer} in exchange.`
        : `Hi ${userName.split(' ')[0]}! I noticed you teach ${want} and I would really like to learn it. Would you be up for a session?`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantSkillId, offerSkillId, theirTeaches, myTeaches]);

  const submit = useAction(async () => {
    if (!wantSkillId) return null;
    try {
      await requests.create({
        receiverId: userId,
        skillId: wantSkillId,
        ...(offerSkillId ? { offeredSkillId: offerSkillId } : {}),
        message: message.trim(),
      });
    } catch (err) {
      offerEmailVerification(err);
      throw err;
    }
    navigation.navigate('LearningRequests');
    return true;
  });

  if (state.loading) return <LoadingView />;

  return (
    <Screen scroll>
      <Title>Request a session</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        Ask {userName} to teach you something.
      </Body>

      {state.error ? <Banner tone="danger" text={state.error} /> : null}
      {submit.error ? <Banner tone="danger" text={submit.error} /> : null}

      {theirTeaches.length === 0 ? (
        <Card>
          <Body muted>
            {userName} has not listed any teaching skills yet, so there is nothing to request.
          </Body>
        </Card>
      ) : (
        <>
          <Field label="What do you want to learn?">
            <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
              {theirTeaches.map((entry) => (
                <Chip
                  key={entry.id}
                  label={entry.skill.name}
                  selected={wantSkillId === entry.skill.id}
                  onPress={() => setWantSkillId(entry.skill.id)}
                />
              ))}
            </Row>
          </Field>

          <Field
            label="Offer something back (optional)"
            hint="A two-way exchange is far more likely to be accepted."
          >
            {myTeaches.length === 0 ? (
              <Caption>
                You have no teaching skills listed yet. Add one to make this an exchange.
              </Caption>
            ) : (
              <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
                <Chip
                  label="Nothing for now"
                  selected={offerSkillId === null}
                  onPress={() => setOfferSkillId(null)}
                />
                {myTeaches.map((entry) => (
                  <Chip
                    key={entry._id}
                    label={entry.skill.name}
                    selected={offerSkillId === entry.skill._id}
                    onPress={() => setOfferSkillId(entry.skill._id)}
                  />
                ))}
              </Row>
            )}
          </Field>

          <Field label="Message" hint={`${message.length}/1000`}>
            <Input
              value={message}
              onChangeText={setMessage}
              placeholder="Introduce yourself and say what you are hoping to learn."
              multiline
              numberOfLines={6}
              maxLength={1000}
              style={{ minHeight: 132, textAlignVertical: 'top' }}
            />
          </Field>

          <Button
            label="Send request"
            icon="paper-plane-outline"
            onPress={() => void submit.run()}
            loading={submit.pending}
            disabled={!wantSkillId || message.trim().length === 0}
          />

          <View style={{ height: t.spacing.xl }} />
        </>
      )}
    </Screen>
  );
}
