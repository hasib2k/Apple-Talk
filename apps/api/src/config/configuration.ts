export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev_secret_change_in_prod',
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '30d',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '30d',
  },
  admin: {
    apiKey: process.env.ADMIN_API_KEY ?? 'dev_admin_key',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/v1/auth/google/callback',
  },
  webrtc: {
    stunUrl: process.env.STUN_SERVER_URL ?? 'stun:stun.l.google.com:19302',
    turnUrl: process.env.TURN_SERVER_URL,
    turnUsername: process.env.TURN_USERNAME,
    turnCredential: process.env.TURN_CREDENTIAL,
  },
});
