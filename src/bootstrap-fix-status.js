/**
 * One-time fix script for invalid project statuses
 * Run this via: node src/bootstrap-fix-status.js
 * Or add to src/index.ts bootstrap function temporarily
 */

const VALID_STATUSES = [
  'pending',
  'in_progress',
  'scheduled',
  'execution_completed',
  'ready_for_review',
  'sent_back_for_revision',
  'approved',
  'completed',
  'archived'
];

module.exports = async ({ strapi }) => {
  console.log('🔧 Fixing invalid project statuses...');

  try {
    // Get all projects with raw query to bypass validation
    const knex = strapi.db.connection;

    // Check current status distribution
    const statusCounts = await knex('projects')
      .select('status')
      .count('* as count')
      .groupBy('status');

    console.log('Current status distribution:', statusCounts);

    // Find invalid statuses
    const invalidStatuses = statusCounts
      .filter(row => !VALID_STATUSES.includes(row.status) && row.status !== null)
      .map(row => row.status);

    if (invalidStatuses.length > 0) {
      console.log('Found invalid statuses:', invalidStatuses);
    }

    // Fix null or empty statuses
    const nullFixed = await knex('projects')
      .whereNull('status')
      .orWhere('status', '')
      .update({ status: 'pending' });

    console.log(`Fixed ${nullFixed} projects with null/empty status`);

    // Fix any other invalid statuses
    if (invalidStatuses.length > 0) {
      const invalidFixed = await knex('projects')
        .whereIn('status', invalidStatuses)
        .update({ status: 'pending' });

      console.log(`Fixed ${invalidFixed} projects with invalid status`);
    }

    console.log('✅ Status fix completed!');
  } catch (error) {
    console.error('❌ Error fixing statuses:', error);
  }
};
