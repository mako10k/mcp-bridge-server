import { AuthenticatedUser } from '../context/auth-context.js';
import { RBACConfig, Role } from '../types/rbac-types.js';

export class PermissionManager {
  constructor(private rbac: RBACConfig) {}

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

  private async getServerInstance(_id: string): Promise<{userId: string}> {
    // Placeholder for server instance lookup
    return { userId: '' };
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

  async checkResourceAccess(user: AuthenticatedUser, action: string, resourceType: string, resourceId: string): Promise<boolean> {
    switch (resourceType) {
      case 'user_config':
        return resourceId === user.id || this.isAdmin(user);
      case 'server_instance': {
        const instance = await this.getServerInstance(resourceId);
        return instance.userId === user.id || this.isAdmin(user);
      }
      default:
        return false;
    }
  }
}
