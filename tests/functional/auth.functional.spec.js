import { expect } from 'chai';
import jwt from 'jsonwebtoken';
import { createAuthMiddlewares } from '../../src/middlewares/auth.js';

const runMiddleware = (middleware, req) => new Promise((resolve) => {
  middleware(req, {}, (error) => resolve(error));
});

const runMiddlewareChain = async (middlewares, req) => {
  for (const middleware of middlewares) {
    const error = await runMiddleware(middleware, req);
    if (error) return error;
  }

  return undefined;
};

describe('Functional - Auth middleware', () => {
  const jwtSecret = 'test-secret-auth';

  it('requireAuth deja pasar cuando AUTH_REQUIRED está desactivado', async () => {
    const { requireAuth } = createAuthMiddlewares({ authRequired: false, jwtSecret });
    const req = { headers: {} };

    const error = await runMiddleware(requireAuth, req);

    expect(error).to.equal(undefined);
  });

  it('requireAuth responde error cuando falta Authorization Bearer', async () => {
    const { requireAuth } = createAuthMiddlewares({ authRequired: true, jwtSecret });
    const req = { headers: {} };

    const error = await runMiddleware(requireAuth, req);

    expect(error).to.exist;
    expect(error.code).to.equal('UNAUTHORIZED_ERROR');
    expect(error.statusCode).to.equal(401);
  });

  it('requireAuth propaga error cuando el token es inválido', async () => {
    const { requireAuth } = createAuthMiddlewares({ authRequired: true, jwtSecret });
    const req = { headers: { authorization: 'Bearer token-invalido' } };

    const error = await runMiddleware(requireAuth, req);

    expect(error).to.exist;
    expect(error.name).to.equal('JsonWebTokenError');
  });

  it('requireAuth responde error si el token no contiene rol utilizable', async () => {
    const { requireAuth } = createAuthMiddlewares({ authRequired: true, jwtSecret });
    const token = jwt.sign({ sub: '123' }, jwtSecret);
    const req = { headers: { authorization: `Bearer ${token}` } };

    const error = await runMiddleware(requireAuth, req);

    expect(error).to.exist;
    expect(error.code).to.equal('UNAUTHORIZED_ERROR');
    expect(error.statusCode).to.equal(401);
  });

  it('requireRoles rechaza cuando el rol no está autorizado', async () => {
    const { requireRoles } = createAuthMiddlewares({ authRequired: true, jwtSecret });
    const token = jwt.sign({ sub: '123', role: 'user' }, jwtSecret);
    const req = { headers: { authorization: `Bearer ${token}` } };

    const error = await runMiddlewareChain(requireRoles(['admin']), req);

    expect(error).to.exist;
    expect(error.code).to.equal('PERMISSION_DENIED_ERROR');
    expect(error.statusCode).to.equal(403);
  });

  it('requireRoles permite acceso cuando el rol está autorizado', async () => {
    const { requireRoles } = createAuthMiddlewares({ authRequired: true, jwtSecret });
    const token = jwt.sign({ sub: '123', role: 'admin' }, jwtSecret);
    const req = { headers: { authorization: `Bearer ${token}` } };

    const error = await runMiddlewareChain(requireRoles(['admin']), req);

    expect(error).to.equal(undefined);
    expect(req.auth).to.include({ role: 'admin', userId: '123' });
  });

  it('requireAuth acepta el claim roles[] cuando role no existe', async () => {
    const { requireAuth } = createAuthMiddlewares({ authRequired: true, jwtSecret });
    const token = jwt.sign({ sub: '999', roles: ['driver'] }, jwtSecret);
    const req = { headers: { authorization: `Bearer ${token}` } };

    const error = await runMiddleware(requireAuth, req);

    expect(error).to.equal(undefined);
    expect(req.auth).to.include({ role: 'driver', userId: '999' });
  });
});
