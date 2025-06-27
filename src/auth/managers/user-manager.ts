// UserManager: Handles user lookup, creation, and role management.
// See docs/mcp-lifecycle-detailed-design.md for integration details.

export interface UserInfo {
  userId: string;
  email: string;
  roles: string[];
  createdAt: Date;
  lastLogin?: Date;
  data?: Record<string, any>;
}

export class UserManager {
  private users: Map<string, UserInfo> = new Map();

  createUser(userId: string, email: string, roles: string[] = []): UserInfo {
    const user: UserInfo = {
      userId,
      email,
      roles,
      createdAt: new Date(),
    };
    this.users.set(userId, user);
    return user;
  }

  getUser(userId: string): UserInfo | undefined {
    return this.users.get(userId);
  }

  updateUserRoles(userId: string, roles: string[]): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.roles = roles;
    return true;
  }

  setLastLogin(userId: string, date: Date = new Date()): void {
    const user = this.users.get(userId);
    if (user) user.lastLogin = date;
  }

  listUsers(): UserInfo[] {
    return Array.from(this.users.values());
  }
}
