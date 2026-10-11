/**
 * LoomIQ Permissions Matrix and Role-Based Access Control (RBAC).
 * Defines granular capabilities and resolves permissions for user roles.
 */

const PERMISSIONS = {
  // Read operations (Owner & Manager)
  READ_DASHBOARD: 'read:dashboard',
  READ_ORDERS: 'read:orders',
  READ_MACHINES: 'read:machines',
  READ_ROLLS: 'read:rolls',
  READ_RADAR: 'read:radar',
  READ_STOCK: 'read:stock',
  READ_QUALITY: 'read:quality',
  VIEW_PROFILE: 'view:profile',

  // Operational writes (Owner & Manager)
  UPDATE_ORDER: 'update:order',
  CREATE_ROLL: 'create:roll',
  INSPECT_ROLL: 'inspect:roll',
  DISPATCH_ROLL: 'dispatch:roll',
  MANAGE_CAPA: 'manage:capa',
  STOCK_RECEIVE: 'stock:receive',
  STOCK_USE: 'stock:use',
  STOCK_ORDER: 'stock:order',
  CHANGE_PASSWORD: 'change:password',

  // Administrative operations (Owner only)
  STOCK_MANAGE: 'stock:manage',      // Add/edit stock items, set reorder thresholds
  STOCK_ADJUST: 'stock:adjust',      // Adjust/correct stock count with reason
  MANAGE_TEAM: 'manage:team',        // List users, invite, revoke, deactivate/reactivate
};

const COMMON_PERMISSIONS = [
  PERMISSIONS.READ_DASHBOARD,
  PERMISSIONS.READ_ORDERS,
  PERMISSIONS.READ_MACHINES,
  PERMISSIONS.READ_ROLLS,
  PERMISSIONS.READ_RADAR,
  PERMISSIONS.READ_STOCK,
  PERMISSIONS.READ_QUALITY,
  PERMISSIONS.VIEW_PROFILE,
  PERMISSIONS.UPDATE_ORDER,
  PERMISSIONS.CREATE_ROLL,
  PERMISSIONS.INSPECT_ROLL,
  PERMISSIONS.DISPATCH_ROLL,
  PERMISSIONS.MANAGE_CAPA,
  PERMISSIONS.STOCK_RECEIVE,
  PERMISSIONS.STOCK_USE,
  PERMISSIONS.STOCK_ORDER,
  PERMISSIONS.CHANGE_PASSWORD,
];

const OWNER_PERMISSIONS = [
  ...COMMON_PERMISSIONS,
  PERMISSIONS.STOCK_MANAGE,
  PERMISSIONS.STOCK_ADJUST,
  PERMISSIONS.MANAGE_TEAM,
];

const MANAGER_PERMISSIONS = [
  ...COMMON_PERMISSIONS,
];

const ROLE_PERMISSIONS_MAP = {
  owner: OWNER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
};

/**
 * Resolves list of permission strings for a given role.
 * @param {string} role - 'owner' | 'manager'
 * @returns {string[]}
 */
const getPermissionsForRole = (role) => {
  return ROLE_PERMISSIONS_MAP[role] || [];
};

/**
 * Checks if a given role has a specific capability.
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
const hasPermission = (role, permission) => {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS_MAP,
  getPermissionsForRole,
  hasPermission,
};
