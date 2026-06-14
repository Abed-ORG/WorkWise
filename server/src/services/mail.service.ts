import { env } from "../config/env";
import nodemailer from "nodemailer";

interface ProjectInvitationEmail {
  to: string;
  recipientName?: string;
  senderName: string;
  projectName: string;
  role: string;
}

interface PasswordResetEmail {
  to: string;
  recipientName: string;
  resetToken: string;
}

interface VerificationEmail {
  to: string;
  recipientName?: string;
  code: string;
}

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const sendMail = async ({ to, subject, text, html }: EmailMessage) => {
  const { resendApiKey, from, smtp } = env.email;
  const smtpConfigured = Boolean(smtp.host && smtp.user && smtp.pass && smtp.from);

  if (!smtpConfigured && !resendApiKey) throw new Error("MAIL_NOT_CONFIGURED");

  try {
    if (smtpConfigured) {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });

      await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        text,
        html,
      });
      return;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });

    if (!response.ok) throw new Error("RESEND_REJECTED_MESSAGE");
  } catch (error) {
    if (error instanceof Error && error.message === "MAIL_NOT_CONFIGURED") throw error;
    throw new Error("EMAIL_DELIVERY_FAILED");
  }
};

const emailShell = (content: string) => `
  <div style="background:#f5f5f3;padding:32px 16px;font-family:Arial,sans-serif;color:#202020">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d6d6d6;border-radius:18px;overflow:hidden">
      <div style="background:#202020;padding:22px 28px;color:#ffee32;font-size:22px;font-weight:800">WorkWise</div>
      <div style="padding:32px 28px">${content}</div>
    </div>
  </div>`;

export const sendProjectInvitationEmail = async ({
  to,
  recipientName,
  senderName,
  projectName,
  role,
}: ProjectInvitationEmail) => {
  const projectsUrl = `${env.frontendUrl}/projects`;
  const greeting = recipientName ? `Hi ${recipientName},` : "Hello,";

  await sendMail({
    to,
    subject: `You're invited to ${projectName} on WorkWise`,
    text: `${greeting}\n\n${senderName} invited you to join ${projectName} as ${role}. Open ${projectsUrl} to accept or decline the invitation.`,
    html: emailShell(`
      <p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
      <h1 style="font-size:26px;margin:0 0 12px">Join ${escapeHtml(projectName)}</h1>
      <p style="line-height:1.65;color:#555;margin:0 0 24px"><strong>${escapeHtml(senderName)}</strong> invited you to collaborate as <strong>${escapeHtml(role)}</strong>.</p>
      <a href="${projectsUrl}" style="display:inline-block;background:#ffd100;color:#202020;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px">View invitation</a>
      <p style="font-size:13px;line-height:1.55;color:#777;margin:24px 0 0">Sign in or create an account with this email address, then accept or decline from your Projects page.</p>
    `),
  });
};

export const sendPasswordResetEmail = async ({
  to,
  recipientName,
  resetToken,
}: PasswordResetEmail) => {
  const resetUrl = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  await sendMail({
    to,
    subject: "Reset your WorkWise password",
    text: `Hi ${recipientName},\n\nReset your WorkWise password using this link: ${resetUrl}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
    html: emailShell(`
      <p style="margin:0 0 16px">Hi ${escapeHtml(recipientName)},</p>
      <h1 style="font-size:26px;margin:0 0 12px">Reset your password</h1>
      <p style="line-height:1.65;color:#555;margin:0 0 24px">Use the secure link below to choose a new WorkWise password. It expires in one hour.</p>
      <a href="${resetUrl}" style="display:inline-block;background:#ffd100;color:#202020;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px">Reset password</a>
      <p style="font-size:13px;line-height:1.55;color:#777;margin:24px 0 0">If you did not request this change, ignore this email. Your password will remain unchanged.</p>
    `),
  });
};

export const sendVerificationEmail = async ({ to, recipientName, code }: VerificationEmail) => {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hello,";

  await sendMail({
    to,
    subject: "Verify your WorkWise email",
    text: `${greeting}\n\nYour WorkWise verification code is ${code}.`,
    html: emailShell(`
      <p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
      <h1 style="font-size:26px;margin:0 0 12px">Verify your email</h1>
      <p style="line-height:1.65;color:#555;margin:0 0 18px">Enter this code in WorkWise:</p>
      <div style="display:inline-block;padding:14px 20px;border-radius:10px;background:#ffee32;color:#202020;font-size:24px;font-weight:800;letter-spacing:6px">${escapeHtml(code)}</div>
    `),
  });
};
