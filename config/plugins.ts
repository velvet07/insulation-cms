// Path:
module.exports = ({ env }) => ({
  email: {
    config: {
      provider: "strapi-provider-email-resend",
      providerOptions: {
        apiKey: env("RESEND_API_KEY"), // Required
      },
      settings: {
        defaultFrom: env("RESEND_DEFAULT_EMAIL"),
        defaultReplyTo: env("RESEND_USER_EMAIL"),
      },
    },
  },
  'users-permissions': {
    config: {
      email: {
        confirmation_redirect_url: `${env('CLIENT_URL')}/email-confirmation`,
      },
    },
  },
});
