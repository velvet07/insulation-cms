/**
 * Custom route for document generation
 */

export default {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/documents/generate',
      handler: 'api::document.document.generate',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/documents/regenerate-with-signature',
      handler: 'api::document.document.regenerateWithSignature',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/documents/sign-pades',
      handler: 'api::document.document.signPades',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/documents/:documentId/verify-signatures',
      handler: 'api::document.document.verifySignatures',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
