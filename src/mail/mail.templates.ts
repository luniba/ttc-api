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

export interface ContactMessage {
  name: string;
  email: string;
  phone: string | null;
  course: string | null;
  message: string;
  subscribe: boolean;
}

// Staff-facing: escaped, and no line breaks in the subject.
export const contactMessageTemplate = (m: ContactMessage): EmailContent => {
  const rows: [string, string][] = [
    ['Name', m.name],
    ['Email', m.email],
    ['Phone', m.phone ?? '—'],
    ['Course', m.course ?? '—'],
    ['Newsletter', m.subscribe ? 'Yes, wants to subscribe' : 'No'],
  ];
  return {
    subject: `New contact message from ${m.name}`.replace(/[\r\n]+/g, ' '),
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nMessage:\n${m.message}\n\nReply to this email to answer ${m.name}.`,
    html: layout(
      'New contact message',
      `<table style="border-collapse:collapse;width:100%;font-size:14px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap">${k}</td><td style="padding:4px 0">${escape(v)}</td></tr>`,
          )
          .join('')}
       </table>
       <p style="margin:20px 0 4px;color:#6b7280;font-size:13px">Message</p>
       <p style="white-space:pre-wrap;margin:0">${escape(m.message)}</p>
       <p style="color:#6b7280;font-size:13px;margin-top:20px">Reply to this email to answer ${escape(m.name)}.</p>`,
    ),
  };
};

export interface PurchaseRequest {
  course: string;
  name: string;
  email: string;
  passportNo: string;
  dateOfBirth: string;
  nationality: string;
  address: string;
  // The candidate's page in the admin panel.
  adminLink: string;
  // They asked for this course before; their request was updated.
  repeat: boolean;
}

export const purchaseRequestTemplate = (r: PurchaseRequest): EmailContent => {
  const rows: [string, string][] = [
    ['Course', r.course],
    ['Name (passport)', r.name],
    ['Email', r.email],
    ['Passport No', r.passportNo],
    ['Date of birth', r.dateOfBirth],
    ['Nationality', r.nationality],
    ['Address', r.address],
  ];
  const note = r.repeat ? 'They had already asked for this course; their details were updated, no second record was added.' : '';
  return {
    subject: `Course purchase request: ${r.course} (${r.name})`.replace(/[\r\n]+/g, ' '),
    text: `${r.name} has requested to purchase "${r.course}".\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${note ? `${note}\n\n` : ''}Open the candidate in the admin panel:\n${r.adminLink}\n\nReply to this email to contact ${r.name}.`,
    html: layout(
      'New course purchase request',
      `<p><strong>${escape(r.name)}</strong> has requested to purchase <strong>${escape(r.course)}</strong>.</p>
       <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0">${escape(v)}</td></tr>`,
          )
          .join('')}
       </table>
       ${note ? `<p style="color:#6b7280;font-size:13px">${escape(note)}</p>` : ''}
       ${button(r.adminLink, 'Open in admin panel')}
       <p style="color:#6b7280;font-size:13px">Reply to this email to contact ${escape(r.name)}.</p>`,
    ),
  };
};

// Receipt for the person who filled in a form.
const urgentLine = (phone: string): { text: string; html: string } =>
  phone
    ? {
        text: `If it's urgent, call us on ${phone}.`,
        html: `If it's urgent, call us on <strong>${escape(phone)}</strong>.`,
      }
    : {
        text: `If it's urgent, just reply to this email.`,
        html: `If it's urgent, just reply to this email.`,
      };

// A new account (with its password) or one they already had.
export type CheckoutAccess =
  | { kind: 'created'; username: string; password: string; loginUrl: string; resetUrl: string }
  | { kind: 'existing'; loginUrl: string; resetUrl: string };

export const checkoutConfirmationTemplate = (
  name: string,
  course: string,
  phone: string,
  access: CheckoutAccess,
): EmailContent => {
  const urgent = urgentLine(phone);
  const loginText =
    access.kind === 'created'
      ? `Meanwhile, you can log in to our system with these details:\n\n  Username: ${access.username}\n  Password: ${access.password}\n\nLog in here: ${access.loginUrl}\nYou can change your password at any time with "Forgot password" on the login page: ${access.resetUrl}`
      : `You already have an account with us, so you can log in as usual: ${access.loginUrl}\nIf you've forgotten your password, reset it here: ${access.resetUrl}`;
  const loginHtml =
    access.kind === 'created'
      ? `<p>Meanwhile, you can log in to our system with these details:</p>
         <table style="border-collapse:collapse;background:#f3f4f6;border-radius:6px;width:100%;font-size:14px">
           <tr><td style="padding:10px 12px;color:#6b7280;white-space:nowrap">Username</td><td style="padding:10px 12px"><strong>${escape(access.username)}</strong></td></tr>
           <tr><td style="padding:10px 12px;color:#6b7280;white-space:nowrap">Password</td><td style="padding:10px 12px"><strong style="font-family:ui-monospace,monospace">${escape(access.password)}</strong></td></tr>
         </table>
         ${button(access.loginUrl, 'Log in')}
         <p style="color:#6b7280;font-size:13px">You can change your password at any time with "Forgot password" on the login page, or <a href="${escape(access.resetUrl)}">right here</a>.</p>`
      : `<p>You already have an account with us, so you can log in as usual.</p>
         ${button(access.loginUrl, 'Log in')}
         <p style="color:#6b7280;font-size:13px">Forgotten your password? <a href="${escape(access.resetUrl)}">Reset it here</a>.</p>`;
  return {
    subject: `We've received your request: ${course}`.replace(/[\r\n]+/g, ' '),
    text: `Hi ${name},\n\nThanks for requesting "${course}". We've received your request, and our team will contact you very soon to complete your enrolment. No payment has been taken.\n\n${loginText}\n\n${urgent.text}\n\n— ${BRAND}`,
    html: layout(
      'We\'ve received your request',
      `<p>Hi ${escape(name)},</p>
       <p>Thanks for requesting <strong>${escape(course)}</strong>. We've received your request, and our team will contact you very soon to complete your enrolment. No payment has been taken.</p>
       ${loginHtml}
       <p style="color:#6b7280;font-size:13px">${urgent.html}</p>`,
    ),
  };
};

export const contactConfirmationTemplate = (name: string, phone: string): EmailContent => {
  const urgent = urgentLine(phone);
  return {
    subject: `We've received your message`,
    text: `Hi ${name},\n\nThanks for getting in touch. We've received your message and will reply within one or two working days.\n\n${urgent.text}\n\n— ${BRAND}`,
    html: layout(
      'We\'ve received your message',
      `<p>Hi ${escape(name)},</p>
       <p>Thanks for getting in touch. We've received your message and will reply within one or two working days.</p>
       <p style="color:#6b7280;font-size:13px">${urgent.html}</p>`,
    ),
  };
};

export const accessGrantedTemplate = (name: string, course: string, accountUrl: string): EmailContent => ({
  subject: `You now have access to ${course}`.replace(/[\r\n]+/g, ' '),
  text: `Hi ${name},\n\nYour access to "${course}" is ready. Log in and open it from My courses:\n${accountUrl}\n\n— ${BRAND}`,
  html: layout(
    'Your course is ready',
    `<p>Hi ${escape(name)},</p>
     <p>Your access to <strong>${escape(course)}</strong> is ready. Log in and open it from <em>My courses</em>.</p>
     ${button(accountUrl, 'Go to my courses')}`,
  ),
});

// Sent only when an admin ticks "email these details".
export const loginDetailsTemplate = (name: string, username: string, password: string, loginUrl: string, resetUrl: string): EmailContent => ({
  subject: `Your ${BRAND} login details`,
  text: `Hi ${name},\n\nWe've created a login for you:\n\n  Username: ${username}\n  Password: ${password}\n\nLog in here: ${loginUrl}\nYou can change your password at any time with "Forgot password" on the login page: ${resetUrl}\n\n— ${BRAND}`,
  html: layout(
    'Your login details',
    `<p>Hi ${escape(name)},</p>
     <p>We've created a login for you:</p>
     <table style="border-collapse:collapse;background:#f3f4f6;border-radius:6px;width:100%;font-size:14px">
       <tr><td style="padding:10px 12px;color:#6b7280;white-space:nowrap">Username</td><td style="padding:10px 12px"><strong>${escape(username)}</strong></td></tr>
       <tr><td style="padding:10px 12px;color:#6b7280;white-space:nowrap">Password</td><td style="padding:10px 12px"><strong style="font-family:ui-monospace,monospace">${escape(password)}</strong></td></tr>
     </table>
     ${button(loginUrl, 'Log in')}
     <p style="color:#6b7280;font-size:13px">You can change your password at any time with "Forgot password" on the login page, or <a href="${escape(resetUrl)}">right here</a>.</p>`,
  ),
});
