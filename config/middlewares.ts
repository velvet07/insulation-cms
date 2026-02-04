export default [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'frame-ancestors': ["'self'", 'http://localhost:3000', 'http://localhost:3001', 'https://cms.emermedia.eu', 'https://app.thermodesk.eu', 'https://thermodesk.eu', 'https://www.thermodesk.eu'],
        },
      },
      frameguard: {
        action: 'sameorigin',
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://cms.emermedia.eu',
        'https://thermodesk.vercel.app',
        'https://app.thermodesk.eu',
        'https://thermodesk.eu',
        'https://www.thermodesk.eu',
      ],
      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
        'X-Requested-With',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      credentials: true,
      keepHeaderOnError: true,
      exposedHeaders: ['Content-Disposition', 'X-Export-Filename'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
