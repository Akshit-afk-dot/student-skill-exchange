import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { reports as reportsApi } from '../api/endpoints';
import {
  Banner,
  Body,
  Button,
  Caption,
  Field,
  Input,
  Row,
  Screen,
  Title,
} from '../components/ui';
import { useAction } from '../hooks/useAsync';
import { useTheme } from '../theme';
import type { ReportReason } from '../types';
import type { RootStackParamList } from '../navigation/types';

const REASONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: 'HARASSMENT', label: 'Harassment or abuse', hint: 'Threats, insults, or unwanted contact' },
  { value: 'SPAM', label: 'Spam', hint: 'Advertising, mass messaging, or scams' },
  { value: 'FAKE_PROFILE', label: 'Fake profile', hint: 'Impersonation or invented credentials' },
  {
    value: 'INAPPROPRIATE_CONTENT',
    label: 'Inappropriate content',
    hint: 'Sexual, violent, or hateful material',
  },
  {
    value: 'SUSPICIOUS_BEHAVIOUR',
    label: 'Suspicious behaviour',
    hint: 'Asking for money, personal data, or off-platform contact',
  },
  { value: 'OTHER', label: 'Something else', hint: 'Describe it below' },
];

export function ReportUserScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId, userName } = useRoute<RouteProp<RootStackParamList, 'ReportUser'>>().params;

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');

  const submit = useAction(async () => {
    if (!reason) return null;
    const result = await reportsApi.create({
      reportedUserId: userId,
      reason,
      ...(description.trim() ? { description: description.trim() } : {}),
    });
    Alert.alert('Report submitted', result.message, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
    return result;
  });

  return (
    <Screen scroll>
      <Title>Report {userName}</Title>
      <Body muted style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
        Reports are reviewed by moderators. {userName} is not told who reported them.
      </Body>

      {submit.error ? <Banner tone="danger" text={submit.error} /> : null}

      <Field label="What happened?">
        <View style={{ gap: t.spacing.sm }}>
          {REASONS.map((option) => {
            const active = reason === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setReason(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  padding: t.spacing.md,
                  borderRadius: t.radius.md,
                  borderWidth: 1,
                  borderColor: active ? t.colors.primary : t.colors.border,
                  backgroundColor: active ? t.colors.primarySoft : t.colors.surface,
                }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body style={{ color: active ? t.colors.primary : t.colors.text, flex: 1 }}>
                    {option.label}
                  </Body>
                  {active ? (
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: t.colors.primary,
                      }}
                    />
                  ) : null}
                </Row>
                <Caption style={{ marginTop: 2 }}>{option.hint}</Caption>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field
        label="Details"
        hint="Specific examples — what was said, and when — help moderators act quickly."
      >
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what happened"
          multiline
          numberOfLines={5}
          maxLength={1000}
          style={{ minHeight: 118, textAlignVertical: 'top' }}
        />
      </Field>

      <Button
        label="Submit report"
        variant="danger"
        icon="flag-outline"
        onPress={() => void submit.run()}
        loading={submit.pending}
        disabled={!reason}
      />

      <Caption style={{ textAlign: 'center', marginTop: t.spacing.md }}>
        If you are in immediate danger, contact your local emergency services.
      </Caption>
    </Screen>
  );
}
