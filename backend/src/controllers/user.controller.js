/**
 * User and Team Management Controller.
 * Restricted to project owners for managing team accounts and manager onboarding invitations.
 */
const { User, Session, Invitation } = require('../models');
const { generateOpaqueToken, hashToken, logSecurityEvent } = require('../utils/security');

/**
 * GET /api/users
 * Returns list of team members (Owner only).
 */
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('name email role isActive lastLoginAt createdAt deactivatedAt createdBy')
      .populate('createdBy', 'name email')
      .sort('-createdAt')
      .lean();

    return res.status(200).json({
      users: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        deactivatedAt: u.deactivatedAt,
        createdBy: u.createdBy ? { id: u.createdBy._id, name: u.createdBy.name } : null,
      })),
      total: users.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/:id
 * Updates team member active state (Owner only).
 * Rejects all fields other than isActive.
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};

    if (isActive === undefined || typeof isActive !== 'boolean') {
      return res.status(422).json({
        error: {
          message: 'Field "isActive" (boolean) is required.',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User account not found.',
          code: 'USER_NOT_FOUND',
        },
      });
    }

    // Safety rule 1: Owner cannot deactivate themselves
    if (req.user._id.toString() === user._id.toString() && isActive === false) {
      return res.status(400).json({
        error: {
          message: 'You cannot deactivate your own account.',
          code: 'CANNOT_DEACTIVATE_SELF',
        },
      });
    }

    // Safety rule 2: The last active owner can never be deactivated
    if (user.role === 'owner' && isActive === false) {
      const activeOwnerCount = await User.countDocuments({ role: 'owner', isActive: true });
      if (activeOwnerCount <= 1) {
        return res.status(400).json({
          error: {
            message: 'Cannot deactivate the last active owner of the factory.',
            code: 'LAST_OWNER_PROTECTED',
          },
        });
      }
    }

    user.isActive = isActive;
    if (isActive) {
      user.deactivatedAt = null;
      user.deactivatedBy = null;
      logSecurityEvent('USER_REACTIVATED', { targetUserId: user._id, byUserId: req.user._id, ip: req.ip });
    } else {
      user.deactivatedAt = new Date();
      user.deactivatedBy = req.user._id;

      // Immediately terminate all sessions for this deactivated user
      await Session.deleteMany({ user: user._id });
      logSecurityEvent('USER_DEACTIVATED', { targetUserId: user._id, byUserId: req.user._id, ip: req.ip });
    }

    await user.save();

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        deactivatedAt: user.deactivatedAt,
      },
      message: `User ${user.email} ${isActive ? 'reactivated' : 'deactivated'} successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invitations
 * Returns list of team invitations (Owner only).
 * Never exposes raw tokens or token hashes.
 */
const getInvitations = async (req, res, next) => {
  try {
    const invitations = await Invitation.find()
      .populate('createdBy', 'name email')
      .populate('usedBy', 'name email')
      .sort('-createdAt')
      .lean();

    return res.status(200).json({
      invitations: invitations.map((inv) => ({
        id: inv._id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        usedAt: inv.usedAt,
        usedBy: inv.usedBy ? { id: inv.usedBy._id, name: inv.usedBy.name, email: inv.usedBy.email } : null,
        revokedAt: inv.revokedAt,
        createdAt: inv.createdAt,
        isExpired: new Date() > new Date(inv.expiresAt),
        createdBy: inv.createdBy ? { id: inv.createdBy._id, name: inv.createdBy.name } : null,
      })),
      total: invitations.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/invitations
 * Creates a single-use onboarding invitation link for a manager (Owner only).
 */
const createInvitation = async (req, res, next) => {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(422).json({
        error: {
          message: 'A valid email address is required.',
          code: 'INVALID_EMAIL',
        },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if active user already exists
    const existingActiveUser = await User.findOne({ email: normalizedEmail, isActive: true });
    if (existingActiveUser) {
      return res.status(409).json({
        error: {
          message: `An active user with email ${normalizedEmail} already exists.`,
          code: 'USER_ALREADY_EXISTS',
        },
      });
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours validity

    const invitation = new Invitation({
      email: normalizedEmail,
      role: 'manager', // Always server-set to manager
      tokenHash,
      expiresAt,
      createdBy: req.user._id,
    });

    await invitation.save();

    logSecurityEvent('INVITATION_CREATED', {
      invitationId: invitation._id,
      email: normalizedEmail,
      byUserId: req.user._id,
      ip: req.ip,
    });

    // The single-use link is returned ONCE to the owner
    const inviteLink = `/accept-invite/${rawToken}`;

    return res.status(201).json({
      inviteLink,
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      message: 'Invitation link generated. Provide this link to the manager. It will expire in 48 hours.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/invitations/:id
 * Revokes a pending invitation (Owner only).
 */
const revokeInvitation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invitation = await Invitation.findById(id);
    if (!invitation) {
      return res.status(404).json({
        error: {
          message: 'Invitation not found.',
          code: 'INVITATION_NOT_FOUND',
        },
      });
    }

    if (invitation.usedAt) {
      return res.status(400).json({
        error: {
          message: 'Cannot revoke an invitation that has already been accepted.',
          code: 'ALREADY_USED',
        },
      });
    }

    invitation.revokedAt = new Date();
    invitation.revokedBy = req.user._id;
    await invitation.save();

    logSecurityEvent('INVITATION_REVOKED', {
      invitationId: invitation._id,
      email: invitation.email,
      byUserId: req.user._id,
      ip: req.ip,
    });

    return res.status(200).json({
      message: `Invitation for ${invitation.email} has been revoked.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  updateUser,
  getInvitations,
  createInvitation,
  revokeInvitation,
};
