import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = {
  provider: string;
  providerMessageId: string;
};

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export type SmtpEmailProviderOptions = {
  host: string;
  port: number;
};

export function createSmtpEmailProvider(
  options: SmtpEmailProviderOptions,
): EmailProvider {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: false,
  });

  return {
    async send(input) {
      const result = await transport.sendMail({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });

      return {
        provider: "smtp",
        providerMessageId: result.messageId,
      };
    },
  };
}

export function buildEmailVerificationMessage(input: {
  appBaseUrl: string;
  email: string;
  fullName: string;
  token: string;
}) {
  const url = `${input.appBaseUrl}/verify-email?token=${encodeURIComponent(input.token)}`;
  return {
    toEmail: input.email,
    templateKey: "identity.email_verification",
    subject: "Verify your HealthHack account",
    textBody: `Hi ${input.fullName}, verify your HealthHack account: ${url}\nThis link expires in 24 hours and can be used once.`,
    htmlBody: `<p>Hi ${escapeHtml(input.fullName)},</p><p>Verify your HealthHack account:</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours and can be used once.</p>`,
  };
}

export function buildPasswordResetMessage(input: {
  appBaseUrl: string;
  email: string;
  token: string;
}) {
  const url = `${input.appBaseUrl}/reset-password?token=${encodeURIComponent(input.token)}`;
  return {
    toEmail: input.email,
    templateKey: "identity.password_reset",
    subject: "Reset your HealthHack password",
    textBody: `Reset your password: ${url}\nThis link expires in one hour and can be used once.`,
    htmlBody: `<p><a href="${url}">Reset your password</a></p><p>This link expires in one hour and can be used once.</p>`,
  };
}

export function buildTeamInvitationMessage(input: {
  appBaseUrl: string;
  email: string;
  invitedName?: string | null;
  teamName: string;
  token: string;
}) {
  const url = `${input.appBaseUrl}/team-invitations/accept?token=${encodeURIComponent(input.token)}`;
  const greeting = input.invitedName ? `Hi ${input.invitedName}` : "Hi";
  return {
    toEmail: input.email,
    templateKey: "team.invitation",
    subject: `Invitation to join ${input.teamName} on HealthHack`,
    textBody: `${greeting}, you have been invited to join ${input.teamName} on HealthHack: ${url}`,
    htmlBody: `<p>${escapeHtml(greeting)},</p><p>You have been invited to join <strong>${escapeHtml(input.teamName)}</strong> on HealthHack.</p><p><a href="${url}">${url}</a></p>`,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
