import crypto from 'node:crypto';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateRandomPassword(): string {
  return crypto.randomBytes(24).toString('base64url').slice(0, 20);
}

const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';
const COMPANY_UID = 'api::company.company';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 24 hours in milliseconds
const CONFIRMATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function parseNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return parseInt(value.trim(), 10);
  return null;
}

async function resolveCompanyId(strapi: any, company: unknown): Promise<number | null> {
  const numericId = parseNumericId(company);
  if (numericId) return numericId;

  if (typeof company !== 'string' || !company.trim()) return null;

  const found = await strapi.entityService.findMany(COMPANY_UID, {
    filters: { documentId: { $eq: company.trim() } },
    fields: ['id'],
    limit: 1,
  });

  return found?.[0]?.id ?? null;
}

async function resolveRoleId(strapi: any, role: unknown): Promise<number | null> {
  if (role === undefined || role === null || role === '') {
    const defaultRole = await strapi.db.query(ROLE_UID).findOne({
      where: { type: 'authenticated' },
    });
    return defaultRole?.id ?? null;
  }

  const numericRoleId = parseNumericId(role);
  if (numericRoleId) {
    const roleEntry = await strapi.db.query(ROLE_UID).findOne({
      where: { id: numericRoleId },
    });
    return roleEntry?.id ?? null;
  }

  if (typeof role === 'string' && role.trim()) {
    const roleEntry = await strapi.db.query(ROLE_UID).findOne({
      where: { type: role.trim() },
    });
    return roleEntry?.id ?? null;
  }

  return null;
}

export default {
  async invite(ctx: any) {
    const authHeader = ctx.request?.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('API token szükséges');
    }

    const body = ctx.request?.body ?? {};
    const { username, email, company, role } = body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return ctx.badRequest('A felhasználónév kötelező és legalább 3 karakter');
    }
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return ctx.badRequest('Érvényes e-mail cím kötelező');
    }

    const strapiInstance = strapi;
    const userService = strapiInstance.plugin('users-permissions').service('user');

    try {
      const usernameValue = username.trim();
      const emailValue = email.trim().toLowerCase();

      const existing = await strapiInstance.db.query(USER_UID).findOne({
        where: {
          $or: [{ username: usernameValue }, { email: emailValue }],
        },
      });

      if (existing) {
        return ctx.badRequest('A felhasználónév vagy e-mail cím már használatban van');
      }

      const tempPassword = generateRandomPassword();
      strapi.log.info(`[invite] Generated temp password for ${emailValue}: ${tempPassword}`);
      const roleId = await resolveRoleId(strapiInstance, role);
      if (!roleId) {
        return ctx.badRequest('Érvénytelen role');
      }

      const companyId = company ? await resolveCompanyId(strapiInstance, company) : null;
      if (company && !companyId) {
        return ctx.badRequest('Érvénytelen company');
      }

      const userData: Record<string, unknown> = {
        username: usernameValue,
        email: emailValue,
        password: tempPassword,
        confirmed: false,
        blocked: false,
        role: roleId,
      };

      const created = await userService.add(userData as any);

      const userId = created?.id;
      if (!userId) {
        return ctx.internalServerError('Felhasználó létrehozása sikertelen');
      }

      // Assign company separately (Strapi v5 relation handling)
      if (companyId) {
        try {
          await strapiInstance.entityService.update(USER_UID, userId, {
            data: {
              company: companyId,
            },
          });
        } catch (companyError: any) {
          strapi.log.error('[invite] Failed to assign company:', companyError);
          // Continue anyway - user is created, company can be set later
        }
      }

      // Use users-permissions configured "Email address confirmation" template.
      await userService.sendConfirmationEmail(created);

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
    } catch (e: any) {
      strapi.log.error('[invite] Error:', e);
      return ctx.internalServerError(e?.message || 'Meghívó küldése sikertelen');
    }
  },

  async confirmAndRequestReset(ctx: any) {
    const confirmation = ctx.request?.body?.confirmation ?? ctx.query?.confirmation ?? '';

    if (!confirmation || typeof confirmation !== 'string') {
      return ctx.badRequest('Érvénytelen vagy hiányzó confirmation token');
    }

    const strapiInstance = strapi;
    const userService = strapiInstance.plugin('users-permissions').service('user');

    try {
      const user = await strapiInstance.db.query(USER_UID).findOne({
        where: { confirmationToken: confirmation.trim() },
      });

      if (!user) {
        return ctx.badRequest('Érvénytelen vagy lejárt megerősítési link');
      }

      if (user.confirmed) {
        return ctx.badRequest('A felhasználó már megerősített');
      }

      // Check token expiry (24 hours from user creation/update)
      const userUpdatedAt = new Date(user.updatedAt || user.createdAt);
      const now = new Date();
      const timeDiff = now.getTime() - userUpdatedAt.getTime();

      if (timeDiff > CONFIRMATION_TOKEN_EXPIRY_MS) {
        return ctx.badRequest('A megerősítési link lejárt. Kérj újat az adminisztrátortól.');
      }

      const resetToken = generateToken();

      // Use entityService to ensure confirmed field is updated
      await strapiInstance.entityService.update(USER_UID, user.id, {
        data: {
          confirmed: true,
          confirmationToken: null,
          resetPasswordToken: resetToken,
        },
      });

      strapi.log.info(`[confirmAndRequestReset] User ${user.email} confirmed and reset token generated`);

      return ctx.send({
        success: true,
        code: resetToken,
        message: 'E-mail megerősítve. Átirányítás a jelszó beállításához.',
      });
    } catch (e: any) {
      strapi.log.error('[confirmAndRequestReset] Error:', e);
      return ctx.internalServerError(e?.message || 'Megerősítés sikertelen');
    }
  },

  async resendConfirmation(ctx: any) {
    const authHeader = ctx.request?.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('API token szükséges');
    }

    const { userId } = ctx.request?.body ?? {};

    if (!userId) {
      return ctx.badRequest('userId kötelező');
    }

    const strapiInstance = strapi;
    const userService = strapiInstance.plugin('users-permissions').service('user');

    try {
      const numericUserId = parseNumericId(userId);
      const user = await strapiInstance.db.query(USER_UID).findOne({
        where: {
          $or: [
            numericUserId ? { id: numericUserId } : null,
            { documentId: { $eq: String(userId) } },
          ].filter(Boolean) as any,
        },
      });

      if (!user) {
        return ctx.notFound('Felhasználó nem található');
      }

      if (user.confirmed) {
        return ctx.badRequest('A felhasználó már megerősített');
      }

      // Send confirmation email
      await userService.sendConfirmationEmail(user);

      return ctx.send({
        success: true,
        message: 'Megerősítő e-mail újraküldve',
      });
    } catch (e: any) {
      strapi.log.error('[resendConfirmation] Error:', e);
      return ctx.internalServerError(e?.message || 'E-mail újraküldése sikertelen');
    }
  },
};
