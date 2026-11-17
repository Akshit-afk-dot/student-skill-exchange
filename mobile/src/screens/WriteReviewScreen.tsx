import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { View } from 'react-native';
import { reviews as reviewsApi } from '../api/endpoints';
import { PopIn } from '../components/motion';
import {
  Avatar,
  Banner,
  Body,
  Button,
  Caption,
  Chip,
  Field,
  Input,
  Row,
  Screen,
  StarPicker,
  Text,
  Title,
} from '../components/ui';
import { haptics } from '../haptics';
import { useAction } from '../hooks/useAsync';
import { useTheme } from '../theme';
import type { RootStackParamList } from '../navigation/types';

const RATING_LABEL: Record<number, string> = {
  1: 'Not helpful',
  2: 'Could be better',
  3: 'It was fine',
  4: 'Good session',
  5: 'Excellent!',
};

/** One-tap praise. Picked tags lead the comment, so a review takes seconds to leave. */
const TAGS = ['Clear explanations', 'Patient', 'Well prepared', 'On time', 'Fun to learn with', 'Great examples'];

export function WriteReviewScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { sessionId, revieweeName } = useRoute<RouteProp<RootStackParamList, 'WriteReview'>>().params;
  const firstName = revieweeName.split(' ')[0] ?? revieweeName;

  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  const submit = useAction(async () => {
    const lead = tags.length > 0 ? `${tags.join(', ')}.` : '';
    const text = [lead, comment.trim()].filter(Boolean).join(' ');
    await reviewsApi.create({ sessionId, rating, ...(text ? { comment: text } : {}) });
    haptics.achievement();
    navigation.goBack();
    return true;
  });

  const labelColour =
    rating >= 4 ? t.colors.success : rating === 3 ? t.colors.textPrimary : rating > 0 ? t.colors.warning : t.colors.textSecondary;

  return (
    <Screen scroll edges={[]}>
      <View style={{ alignItems: 'center', marginTop: t.spacing.md }}>
        <Avatar name={revieweeName} size={72} />
        <Title style={{ textAlign: 'center', marginTop: t.spacing.md }}>How was it with {firstName}?</Title>
        <Body muted small style={{ textAlign: 'center', marginTop: 4, maxWidth: 300 }}>
          Your rating helps other students decide who to reach out to.
        </Body>
      </View>

      {submit.error ? (
        <View style={{ marginTop: t.spacing.lg }}>
          <Banner tone="danger" text={submit.error} />
        </View>
      ) : null}

      <View style={{ alignItems: 'center', marginVertical: t.spacing.xl }}>
        <StarPicker value={rating} onChange={setRating} size={46} />
        <View style={{ height: 30, marginTop: t.spacing.md, justifyContent: 'center' }}>
          {rating > 0 ? (
            <PopIn key={rating}>
              <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '800', color: labelColour }}>
                {RATING_LABEL[rating]}
              </Text>
            </PopIn>
          ) : (
            <Caption>Tap a star</Caption>
          )}
        </View>
      </View>

      {rating >= 4 ? (
        <View style={{ marginBottom: t.spacing.lg }}>
          <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: '600', color: t.colors.textPrimary, marginBottom: 8 }}>
            What stood out?
          </Text>
          <Row gap={t.spacing.sm} style={{ flexWrap: 'wrap' }}>
            {TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <Chip
                  key={tag}
                  label={tag}
                  selected={on}
                  onPress={() => setTags(on ? tags.filter((x) => x !== tag) : [...tags, tag])}
                />
              );
            })}
          </Row>
        </View>
      ) : null}

      <Field label="Add a comment (optional)" hint="Specific feedback is far more useful than stars alone.">
        <Input
          value={comment}
          onChangeText={setComment}
          placeholder="e.g. Explained recursion with clear examples and was patient with my questions."
          multiline
          numberOfLines={5}
          maxLength={1000}
          style={{ minHeight: 118, textAlignVertical: 'top' }}
        />
      </Field>

      <Button
        label="Submit rating"
        icon="star"
        onPress={() => void submit.run()}
        loading={submit.pending}
        disabled={rating === 0}
      />

      <Caption style={{ textAlign: 'center', marginTop: t.spacing.md, marginBottom: t.spacing.xl }}>
        You can edit or withdraw this within 24 hours.
      </Caption>
    </Screen>
  );
}
