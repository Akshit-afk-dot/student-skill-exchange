import { Alert } from 'react-native';
import { ApiError } from '../api/client';
import { auth as authApi } from '../api/endpoints';

/**
 * When an action failed only because the student's email is unverified, offers to send
 * a fresh link on the spot, rather than leaving them to find the option in Settings.
 * Returns true when it recognised the error. The caller still shows its own banner.
 */
export function offerEmailVerification(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.code !== 'EMAIL_NOT_VERIFIED') return false;

  Alert.alert(
    'Verify your email first',
    'To keep the community free of spam and fake accounts, confirm your email address before sending requests and messages.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Resend link',
        onPress: () => {
          authApi
            .resendVerification()
            .then(() => Alert.alert('Link sent', 'Check your inbox, and your spam folder if it is not there.'))
            .catch((e: unknown) =>
              Alert.alert('Could not send the link', e instanceof Error ? e.message : 'Try again from Settings.'),
            );
        },
      },
    ],
  );
  return true;
}
