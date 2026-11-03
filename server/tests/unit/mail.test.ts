import { describe, expect, it } from 'vitest';
import {
  buildAccountDeletedEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
} from '../../src/modules/notifications/mail';
import { keyFromUrl } from '../../src/modules/uploads/storage';
import { escapeHtml } from '../../src/utils/html';

const hostileName = '<a href="https://evil.example">Click here</a><img src=x onerror=alert(1)>';

describe('email HTML', () => {
  it('never lets a student’s name inject markup', () => {
    for (const email of [
      buildVerificationEmail(hostileName, 'token123'),
      buildPasswordResetEmail(hostileName, '123456'),
      buildAccountDeletedEmail(hostileName),
    ]) {
      expect(email.html).not.toContain('<a href="https://evil.example">');
      expect(email.html).not.toContain('<img');
      expect(email.html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;');
    }
  });

  it('puts the token in the verification link', () => {
    const email = buildVerificationEmail('Aarav', 'abc123');
    expect(email.text).toContain('/api/v1/auth/verify-email?token=abc123');
    expect(email.html).toContain('/api/v1/auth/verify-email?token=abc123');
  });

  it('escapes every special character', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('keyFromUrl', () => {
  it('recovers keys for files this server stored, and nothing else', () => {
    expect(keyFromUrl('http://localhost:4000/uploads/avatars/abc.jpg')).toBe('avatars/abc.jpg');
    expect(
      keyFromUrl('https://res.cloudinary.com/demo/image/upload/v1700000000/student-skill-exchange/avatars/abc.jpg'),
    ).toBe('student-skill-exchange/avatars/abc');
    expect(keyFromUrl('https://example.com/someone-elses/photo.jpg')).toBeNull();
  });
});
