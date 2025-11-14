import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory-adapter';
import { toNodeHandler } from 'better-auth/node';
import nodemailer from 'nodemailer';

const smtpHost = process.env.BETTER_AUTH_SMTP_HOST;
const smtpPort = Number(process.env.BETTER_AUTH_SMTP_PORT ?? 587);
const smtpUser = process.env.BETTER_AUTH_SMTP_USER;
const smtpPass = process.env.BETTER_AUTH_SMTP_PASS;
const emailFrom = process.env.BETTER_AUTH_EMAIL_FROM ?? 'Tab Sync <no-reply@example.com>';

const transporter = nodemailer.createTransport(
  smtpHost
    ? {
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
      }
    : {
        streamTransport: true,
        newline: 'unix',
        buffer: true
      }
);

const memoryDb = {};

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? 'set-a-secret-in-env',
  baseURL: process.env.BETTER_AUTH_BASE_URL ?? 'http://localhost:8788',
  basePath: '/auth',
  database: memoryAdapter(memoryDb),
  emailVerification: {
    async sendVerificationEmail({ email, url }) {
      const mail = await transporter.sendMail({
        from: emailFrom,
        to: email,
        subject: 'Sign in to Tab Group Sync',
        html: `<!doctype html><p>Click <a href="${url}">this link</a> to finish signing in.</p>`
      });
      if (mail.message) {
        console.info('[better-auth] email preview:\n', mail.message.toString());
      }
    }
  }
});

export function registerAuthRoutes(app) {
  const handler = toNodeHandler(auth.handler);
  app.all('/auth/*', async (request, reply) => {
    const response = await handler(request.raw, reply.raw);
    if (response) {
      const body = await response.arrayBuffer();
      reply
        .status(response.status)
        .headers(Object.fromEntries(response.headers.entries()))
        .send(Buffer.from(body));
    } else {
      reply.sent = true;
    }
  });
}

export async function requireSession(request) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Missing authorization token.');
  }
  const token = authorization.replace('Bearer ', '').trim();
  const session = await auth.api.getSession({
    headers: new Headers({ Authorization: `Bearer ${token}` })
  });
  if (!session) {
    throw new Error('Session not found.');
  }
  return session;
}
