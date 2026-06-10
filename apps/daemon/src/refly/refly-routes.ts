/**
 * Refly auth mock — minimal endpoints for auto-login.
 * Refly's canvas/workflow calls go to the real Refly API backend.
 * Only auth (login/signup/config/user) is handled here.
 */
import type { Router, Request, Response } from 'express';

const DEFAULT_USER = {
  uid: 'shopagent', avatar: '', name: 'shopagent', nickname: 'ShopAgent',
  email: 'agent@shopagent.local', emailVerified: true,
  uiLocale: 'zh-CN', outputLocale: 'zh-CN', hasBetaAccess: true,
  preferences: {
    hasBeenInvited: true, hasFilledForm: true, providerMode: 'custom',
    operationMode: 'mouse', disableHoverCard: false,
  },
};
const TOKEN = 'shopagent-mock-session-token';
const COOKIE = [
  '_rf_uid=shopagent; Path=/; Max-Age=86400; SameSite=Lax',
  '_rf_email=agent%40shopagent.local; Path=/; Max-Age=86400; SameSite=Lax',
];

function ok(data: unknown) { return { success: true, data }; }

export function registerReflyRoutes(router: Router): void {
  // Global auth cookie — every request keeps you logged in
  router.use('/api/refly', (_req: Request, res: Response, next: () => void) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Set-Cookie', COOKIE);
    if (_req.method === 'OPTIONS') { res.status(204).end(); return; }
    next();
  });

  // Auth — accept any credentials
  router.post('/api/refly/auth/email/login', (_req, res) => { res.json(ok({ accessToken: TOKEN })); });
  router.post('/api/refly/auth/email/signup', (_req, res) => { res.json(ok({ sessionId: '', skipVerification: true })); });
  router.get('/api/refly/auth/config', (_req, res) => res.json(ok({ providers: ['email'], turnstileEnabled: false })));
  router.post('/api/refly/auth/refreshToken', (_req, res) => res.json(ok({ accessToken: TOKEN })));
  router.post('/api/refly/auth/logout', (_req, res) => res.json(ok({})));

  // User — return default user
  router.get('/api/refly/v1/user/settings', (_req, res) => res.json(ok(DEFAULT_USER)));
  router.get('/api/refly/v1/user', (_req, res) => res.json(ok(DEFAULT_USER)));

  // All other /api/refly/* requests — proxy to real Refly backend (if available)
  // When Refly full backend is running, uncomment:
  // router.use('/api/refly', (req, res) => { ... proxy to Refly API ... });

  console.log('[refly] Auth routes registered');
}
