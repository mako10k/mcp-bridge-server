import { AuthenticatedUser } from '../context/auth-context.js';
import { MCPLifecycleManager } from '../../mcp/lifecycle/mcp-lifecycle-manager.js';

/**
 * Simple resource access control checks.
 * This will later be extended to consult databases or lifecycle managers.
 */
export class ResourceAccessControl {
  constructor(private lifecycle = MCPLifecycleManager.getInstance()) {}
  /**
   * Lookup server instance metadata to determine owner.
   * Placeholder for future implementation.
   */
  protected async getServerInstance(id: string): Promise<{ userId: string } | null> {
    const inst = this.lifecycle.findInstanceById(id);
    if (inst) return { userId: inst.context.userId! };
    return null;
  }

  /**
   * Check if a user is allowed to perform an action on a resource.
   */
  async checkAccess(
    user: AuthenticatedUser,
    action: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    const isAdmin = user.roles?.includes('admin');
    switch (resourceType) {
      case 'user_config':
        return resourceId === user.id || !!isAdmin;
      case 'server_instance': {
        const instance = await this.getServerInstance(resourceId);
        return instance?.userId === user.id || !!isAdmin;
      }
      default:
        return false;
    }
  }
}
