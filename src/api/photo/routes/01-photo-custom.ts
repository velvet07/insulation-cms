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
    {
      method: 'PUT',
      path: '/photos/:id/update-with-relations',
      handler: 'photo.updateWithRelations',
      config: {
        auth: false,
      },
    },
  ],
};
