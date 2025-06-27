// Utility for expanding environment variables in objects and strings

export function expandEnvVars(value: string): string {
  return value.replace(/\${([^}]+)}/g, (match, varName) => {
    return process.env[varName] || match;
  });
}

export function expandEnvVarsInObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = expandEnvVars(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string' ? expandEnvVars(item) :
        typeof item === 'object' && item !== null ? expandEnvVarsInObject(item) :
        item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = expandEnvVarsInObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
