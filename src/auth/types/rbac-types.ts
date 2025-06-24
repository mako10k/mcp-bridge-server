export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'system' | 'user' | 'server' | 'resource' | 'config';
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  isSystemRole: boolean;
}

export interface UserMapping {
  email: string;
  role: string;
}

export interface RBACConfig {
  defaultRole: string;
  roles: Record<string, Role>;
  userMappings?: UserMapping[];
}
