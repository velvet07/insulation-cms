export default [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'frame-ancestors': ["'self'", 'http://localhost:3000', 'http://localhost:3001', 'https://cms.emermedia.eu', /^https:\/\/.*\.emermedia\.eu$/],
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
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://cms.emermedia.eu',
        'https://thermodesk.vercel.app',
        /^https:\/\/.*\.emermedia\.eu$/,
        /^https:\/\/.*\.vercel\.app$/,
      ],
      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      credentials: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
