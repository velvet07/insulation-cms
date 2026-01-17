export default {
  routes: [
    {
      method: 'POST',
      path: '/photos/create-with-relations',
      handler: 'photo.createWithRelations',
      config: {
        auth: false,
      },
    },
  ],
};
