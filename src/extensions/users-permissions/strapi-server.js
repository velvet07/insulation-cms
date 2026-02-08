const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateRandomPassword() {
  return crypto.randomBytes(24).toString('base64url').slice(0, 20);
}

// 24 hours in milliseconds
const CONFIRMATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

module.exports = (plugin) => {
  // Ensure controllers structure exists
  if (!plugin.controllers) plugin.controllers = {};

  const invite = async (ctx) => {
    const authHeader = ctx.request?.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('API token szükséges');
    }

    const body = ctx.request?.body ?? {};
    const { username, email, company, role } = body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return ctx.badRequest('A felhasználónév kötelező és legalább 3 karakter');
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ctx.badRequest('Érvényes e-mail cím kötelező');
    }

    const strapi = ctx.state?.strapi ?? ctx.app;
    if (!strapi) throw new Error('Strapi instance not available');
    const userService = strapi.documents('plugin::users-permissions.user');

    try {
      const existing = await userService.findMany({
        filters: {
          $or: [
            { username: { $eq: username.trim() } },
            { email: { $eq: email.trim().toLowerCase() } },
          ],
        },
        limit: 1,
      });
      if (existing && existing.length > 0) {
        return ctx.badRequest('A felhasználónév vagy e-mail cím már használatban van');
      }

      const tempPassword = generateRandomPassword();
      const defaultRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
      });
      const roleId = role ?? defaultRole?.id;

      const userData = {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: tempPassword,
        confirmed: false,
        blocked: false,
        role: roleId,
      };

      const created = await userService.create({
        data: userData,
      });

      const userId = created?.id ?? created?.documentId;
      if (!userId) {
        return ctx.internalServerError('Felhasználó létrehozása sikertelen');
      }

      if (company) {
        try {
          const companyService = strapi.documents('api::company.company');
          await companyService.update({
            documentId: String(company),
            data: {
              user: { connect: [userId] },
            },
          });
        } catch (e) {
          strapi.log.warn('[invite] Company assignment failed:', e);
        }
      }

      if (roleId && roleId !== defaultRole?.id) {
        try {
          await userService.update({
            documentId: String(userId),
            data: { role: roleId },
          });
        } catch (e) {
          strapi.log.warn('[invite] Role update failed:', e);
        }
      }

      // Use users-permissions configured "Email address confirmation" template.
      await strapi.plugin('users-permissions').service('user').sendConfirmationEmail(created);

      return ctx.send({
        success: true,
        message: 'Meghívó e-mail elküldve',
        user: {
          id: userId,
          username: created.username,
          email: created.email,
          confirmed: false,
        },
      });
    } catch (e) {
      strapi.log.error('[invite] Error:', e);
      return ctx.internalServerError(e?.message || 'Meghívó küldése sikertelen');
    }
  };

  const confirmAndRequestReset = async (ctx) => {
    const confirmation = ctx.request?.body?.confirmation ?? ctx.query?.confirmation ?? '';

    if (!confirmation || typeof confirmation !== 'string') {
      return ctx.badRequest('Érvénytelen vagy hiányzó confirmation token');
    }

    const strapi = ctx.state?.strapi ?? ctx.app;
    if (!strapi) throw new Error('Strapi instance not available');
    const userService = strapi.documents('plugin::users-permissions.user');

    try {
      const users = await userService.findMany({
        filters: { confirmationToken: { $eq: confirmation.trim() } },
        limit: 1,
      });

      const user = users?.[0];
      if (!user) {
        return ctx.badRequest('Érvénytelen vagy lejárt megerősítési link');
      }

      // Check token expiry (24 hours from user creation/update)
      const userUpdatedAt = new Date(user.updatedAt || user.createdAt);
      const now = new Date();
      const timeDiff = now.getTime() - userUpdatedAt.getTime();

      if (timeDiff > CONFIRMATION_TOKEN_EXPIRY_MS) {
        return ctx.badRequest('A megerősítési link lejárt. Kérj újat az adminisztrátortól.');
      }

      const resetToken = generateToken();

      await userService.update({
        documentId: String(user.documentId ?? user.id),
        data: {
          confirmed: true,
          confirmationToken: null,
          resetPasswordToken: resetToken,
        },
      });

      return ctx.send({
        success: true,
        code: resetToken,
        message: 'E-mail megerősítve. Átirányítás a jelszó beállításához.',
      });
    } catch (e) {
      strapi.log.error('[confirmAndRequestReset] Error:', e);
      return ctx.internalServerError(e?.message || 'Megerősítés sikertelen');
    }
  };

  const resendConfirmation = async (ctx) => {
    const authHeader = ctx.request?.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('API token szükséges');
    }

    const { userId } = ctx.request?.body ?? {};

    if (!userId) {
      return ctx.badRequest('userId kötelező');
    }

    const strapi = ctx.state?.strapi ?? ctx.app;
    if (!strapi) throw new Error('Strapi instance not available');
    const userService = strapi.documents('plugin::users-permissions.user');

    try {
      const users = await userService.findMany({
        filters: {
          $or: [
            { id: { $eq: userId } },
            { documentId: { $eq: userId } },
          ],
        },
        limit: 1,
      });

      const user = users?.[0];
      if (!user) {
        return ctx.notFound('Felhasználó nem található');
      }

      if (user.confirmed) {
        return ctx.badRequest('A felhasználó már megerősített');
      }

      // Generate new confirmation token if not exists
      let needsUpdate = false;
      let userData = user;

      if (!user.confirmationToken) {
        const newToken = generateToken();
        await userService.update({
          documentId: String(user.documentId ?? user.id),
          data: {
            confirmationToken: newToken,
          },
        });
        needsUpdate = true;
        userData = await userService.findOne({
          documentId: String(user.documentId ?? user.id),
        });
      }

      // Send confirmation email
      await strapi.plugin('users-permissions').service('user').sendConfirmationEmail(userData);

      return ctx.send({
        success: true,
        message: 'Megerősítő e-mail újraküldve',
      });
    } catch (e) {
      strapi.log.error('[resendConfirmation] Error:', e);
      return ctx.internalServerError(e?.message || 'E-mail újraküldése sikertelen');
    }
  };

  // Register custom controller under its own namespace
  plugin.controllers.invite = {
    invite,
    confirmAndRequestReset,
    resendConfirmation,
  };

  const contentApi = plugin.routes?.['content-api'];
  if (contentApi && Array.isArray(contentApi.routes)) {
    contentApi.routes.push(
      {
        method: 'POST',
        path: '/auth/invite',
        handler: 'invite.invite',
        config: {
          auth: false,
          policies: [],
        },
      },
      {
        method: 'POST',
        path: '/auth/confirm-and-request-reset',
        handler: 'invite.confirmAndRequestReset',
        config: {
          auth: false,
          policies: [],
        },
      },
      {
        method: 'POST',
        path: '/auth/resend-confirmation',
        handler: 'invite.resendConfirmation',
        config: {
          auth: false,
          policies: [],
        },
      }
    );
  }

  return plugin;
};