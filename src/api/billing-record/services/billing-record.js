'use strict';

/**
 * billing-record service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::billing-record.billing-record');
