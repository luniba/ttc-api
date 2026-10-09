// Plain template literals, not a template engine — too few emails to justify one. Every template includes a text part since HTML-only scores as spam.

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const BRAND = 'TESOL TEFL Council';

// `name` is user-controlled and goes straight into the markup, so without escaping, a user could inject HTML into an email sent on their behalf.
const escape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const layout = (heading: string, body: string): string => `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;color:#111827;padding:24px">
    <h2 style="color:#1d4ed8;margin:0 0 16px">${heading}</h2>
    ${body}
    <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">
      ${BRAND}
    </p>
  </div>
`;

const button = (href: string, label: string): string => `
  <p style="margin:24px 0">
    <a href="${href}" style="background:#1d4ed8;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${label}</a>
  </p>
  <p style="color:#6b7280;font-size:13px">Or paste this link into your browser:<br><span style="word-break:break-all">${href}</span></p>
`;

export const verifyEmailTemplate = (name: string, link: string, ttlHours: number): EmailContent => ({
  subject: `Confirm your ${BRAND} email address`,
  text: `Hi ${name},\n\nConfirm your email address to activate your account:\n${link}\n\nThis link expires in ${ttlHours} hours.\n\nIf you didn't create an account, you can ignore this email.\n\n— ${BRAND}`,
  html: layout(
    'Confirm your email',
    `<p>Hi ${escape(name)},</p>
     <p>Confirm your email address to activate your account.</p>
     ${button(link, 'Confirm email')}
     <p style="color:#6b7280;font-size:13px">This link expires in ${ttlHours} hours. If you didn't create an account, you can ignore this email.</p>`,
  ),
});

export const passwordResetTemplate = (link: string, ttlMinutes: number): EmailContent => ({
  subject: `Reset your ${BRAND} password`,
  text: `You requested a password reset.\n\nSet a new password:\n${link}\n\nThis link expires in ${ttlMinutes} minutes.\n\nIf you didn't request this, you can safely ignore this email — your password will not change.\n\n— ${BRAND}`,
  html: layout(
    'Reset your password',
    `<p>You requested a password reset.</p>
     ${button(link, 'Set a new password')}
     <p style="color:#6b7280;font-size:13px">This link expires in ${ttlMinutes} minutes. If you didn't request this, you can safely ignore this email — your password will not change.</p>`,
  ),
});

export const passwordChangedTemplate = (): EmailContent => ({
  subject: `Your ${BRAND} password was changed`,
  text: `Your password was just changed and all other sessions were signed out.\n\nIf this wasn't you, reset your password immediately.\n\n— ${BRAND}`,
  html: layout(
    'Your password was changed',
    `<p>Your password was just changed, and every other session has been signed out.</p>
     <p style="color:#b91c1c"><strong>If this wasn't you, reset your password immediately.</strong></p>`,
  ),
});

export const welcomeTemplate = (name: string): EmailContent => ({
  subject: `Welcome to ${BRAND}`,
  text: `Hi ${name},\n\nYour email is confirmed and your account is ready.\n\n— ${BRAND}`,
  html: layout(
    'Your account is ready',
    `<p>Hi ${escape(name)},</p><p>Your email is confirmed and your account is ready to use.</p>`,
  ),
});
