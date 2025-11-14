import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { listSessions, saveSession, deleteSession } from './db.js';
import { auth, registerAuthRoutes, requireSession } from './auth.js';

dotenv.config();

const PORT = Number(process.env.PORT ?? 8788);

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  registerAuthRoutes(app);

  app.post('/api/auth/sign-up', async (request, reply) => {
    try {
      const { email, password, name } = request.body ?? {};
      if (!email || !password) {
        throw new Error('Email and password are required.');
      }
      const result = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: name || email.split('@')[0],
          rememberMe: true
        }
      });
      reply.send(result);
    } catch (error) {
      reply.status(400).send({ error: error.message });
    }
  });

  app.post('/api/auth/sign-in', async (request, reply) => {
    try {
      const { email, password } = request.body ?? {};
      if (!email || !password) {
        throw new Error('Email and password are required.');
      }
      const result = await auth.api.signInEmail({
        body: {
          email,
          password,
          rememberMe: true
        }
      });
      reply.send(result);
    } catch (error) {
      reply.status(400).send({ error: error.message });
    }
  });

  app.post('/api/auth/sign-out', async (request, reply) => {
    try {
      const { token } = request.body ?? {};
      if (!token) {
        throw new Error('Missing session token.');
      }
      await auth.api.signOut({
        headers: new Headers({ Authorization: `Bearer ${token}` })
      });
      reply.status(204).send();
    } catch (error) {
      reply.status(400).send({ error: error.message });
    }
  });

  app.get('/api/session', async (request, reply) => {
    try {
      const session = await requireSession(request);
      const sessions = listSessions(session.user.id);
      reply.send({ sessions });
    } catch (error) {
      reply.status(401).send({ error: error.message });
    }
  });

  app.post('/api/session', async (request, reply) => {
    try {
      const session = await requireSession(request);
      const saved = saveSession(session.user.id, request.body?.session);
      reply.status(201).send({ session: saved });
    } catch (error) {
      reply.status(error.message === 'Missing authorization token.' ? 401 : 400).send({
        error: error.message
      });
    }
  });

  app.delete('/api/session/:id', async (request, reply) => {
    try {
      const session = await requireSession(request);
      deleteSession(session.user.id, request.params.id);
      reply.status(204).send();
    } catch (error) {
      reply.status(error.message === 'Missing authorization token.' ? 401 : 400).send({
        error: error.message
      });
    }
  });

  app.get('/health', async () => ({ status: 'ok', auth: !!auth }));

  return app;
}

const start = async () => {
  const app = await buildServer();
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`Better Auth backend listening on http://localhost:${PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildServer };
