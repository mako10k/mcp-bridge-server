import { AuthenticatedUser } from '../context/auth-context.js';
import { RBACConfig, Role } from '../types/rbac-types.js';
import { ResourceAccessControl } from './resource-access-control.js';

export class PermissionManager {
  constructor(private rbac: RBACConfig, private access = new ResourceAccessControl()) {}

  updateConfig(rbac: RBACConfig) {
    this.rbac = rbac;
  }

  private async getUserRoles(userId: string): Promise<Role[]> {
    const roles: Role[] = [];
    const user = Object.values(this.rbac.roles).find(r => r.id === userId);
    if (user) roles.push(user);
    return roles.length > 0 ? roles : [this.rbac.roles[this.rbac.defaultRole]];
  }

  private async roleHasPermission(role: Role, permission: string, _resource?: any): Promise<boolean> {
    return role.permissions.includes('*') || role.permissions.includes(permission);
  }

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.roles?.includes('admin');
  }

  async checkPermission(user: AuthenticatedUser, permission: string, resource?: any): Promise<boolean> {
    const roles = await this.getUserRoles(user.id);
    for (const role of roles) {
      if (await this.roleHasPermission(role, permission, resource)) {
        return true;
      }
    }
    return false;
  }

  async checkResourceAccess(
    user: AuthenticatedUser,
    action: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    return this.access.checkAccess(user, action, resourceType, resourceId);
  }
}
