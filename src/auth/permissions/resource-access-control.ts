import { AuthenticatedUser } from '../context/auth-context.js';
import { MCPLifecycleManager } from '../../mcp/lifecycle/mcp-lifecycle-manager.js';
import { auditLogger } from '../../utils/audit-logger.js';

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
    let allowed = false;
    switch (resourceType) {
      case 'user_config':
        allowed = resourceId === user.id || !!isAdmin;
        break;
      case 'server_instance': {
        const instance = await this.getServerInstance(resourceId);
        allowed = instance?.userId === user.id || !!isAdmin;
        break;
      }
      default:
        allowed = false;
    }
    auditLogger.log({
      timestamp: new Date().toISOString(),
      level: allowed ? 'INFO' : 'WARN',
      message: `ACCESS_CHECK user=${user.id} action=${action} resource=${resourceType}:${resourceId} allowed=${allowed}`
    });
    return allowed;
  }
}
