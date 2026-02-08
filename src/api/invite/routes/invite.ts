export default {
  routes: [
    {
      method: 'POST',
      path: '/invite',
      handler: 'invite.invite',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/invite/confirm-and-request-reset',
      handler: 'invite.confirmAndRequestReset',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/invite/resend-confirmation',
      handler: 'invite.resendConfirmation',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
