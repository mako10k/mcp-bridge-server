import { AuthenticatedUser } from '../context/auth-context.js';

/**
 * Simple resource access control checks.
 * This will later be extended to consult databases or lifecycle managers.
 */
export class ResourceAccessControl {
  /**
   * Lookup server instance metadata to determine owner.
   * Placeholder for future implementation.
   */
  protected async getServerInstance(id: string): Promise<{ userId: string } | null> {
    // TODO: integrate with lifecycle manager
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
