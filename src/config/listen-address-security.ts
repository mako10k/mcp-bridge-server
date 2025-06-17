import { logger } from '../utils/logger.js';

// Security configuration for listen address
export interface SecurityConfig {
  authentication: {
    enabled: boolean;
    allowedHosts?: string[];
    defaultListenAddress?: string;
  };
  network: {
    allowExternalAccess?: boolean;
    listenAddress?: string;
    trustedProxies?: string[];
  };
}

export class ListenAddressSecurityManager {
  private authEnabled: boolean = false;
  private allowExternalAccess: boolean = false;
  private configuredListenAddress: string = '127.0.0.1';
  private trustedProxies: string[] = [];

  constructor() {
    this.loadSecurityConfig();
  }

  private loadSecurityConfig(): void {
    // Load from environment variables
    this.authEnabled = process.env.AUTH_ENABLED === 'true';
    this.allowExternalAccess = process.env.ALLOW_EXTERNAL_ACCESS === 'true';
    this.configuredListenAddress = process.env.LISTEN_ADDRESS || '127.0.0.1';
    
    if (process.env.TRUSTED_PROXIES) {
      this.trustedProxies = process.env.TRUSTED_PROXIES.split(',').map(ip => ip.trim());
    }
  }

  /**
   * Determine the appropriate listen address based on security configuration
   */
  getListenAddress(): string {
    // Security rule: If authentication is disabled, force localhost binding
    if (!this.authEnabled) {
      if (this.configuredListenAddress !== '127.0.0.1' && this.configuredListenAddress !== 'localhost') {
        logger.warn(
          'Authentication is disabled. Forcing listen address to localhost (127.0.0.1) for security. ' +
          'To allow external access, enable authentication first.'
        );
      }
      return '127.0.0.1';
    }

    // Security rule: If authentication is enabled but external access is explicitly denied
    if (this.authEnabled && !this.allowExternalAccess) {
      logger.info('Authentication enabled but external access denied. Using localhost (127.0.0.1)');
      return '127.0.0.1';
    }

    // Security rule: If authentication is enabled and external access is allowed
    if (this.authEnabled && this.allowExternalAccess) {
      const finalAddress = this.configuredListenAddress;
      
      if (finalAddress !== '127.0.0.1' && finalAddress !== 'localhost') {
        logger.info(
          `Authentication enabled and external access allowed. ` +
          `Listening on: ${finalAddress}. Ensure proper firewall and HTTPS configuration.`
        );
        
        // Security warning for production
        if (finalAddress === '0.0.0.0') {
          logger.warn(
            'WARNING: Server is listening on all interfaces (0.0.0.0). ' +
            'Ensure proper security measures are in place: HTTPS, firewall, rate limiting.'
          );
        }
      }
      
      return finalAddress;
    }

    // Default fallback
    return '127.0.0.1';
  }

  /**
   * Update authentication status and recalculate listen address
   */
  updateAuthenticationStatus(enabled: boolean): void {
    const previousAddress = this.getListenAddress();
    this.authEnabled = enabled;
    const newAddress = this.getListenAddress();

    if (previousAddress !== newAddress) {
      logger.info(
        `Authentication status changed (enabled: ${enabled}). ` +
        `Listen address updated: ${previousAddress} -> ${newAddress}`
      );
    }
  }

  /**
   * Update external access configuration
   */
  updateExternalAccessConfig(allowed: boolean): void {
    const previousAddress = this.getListenAddress();
    this.allowExternalAccess = allowed;
    const newAddress = this.getListenAddress();

    if (previousAddress !== newAddress) {
      logger.info(
        `External access configuration changed (allowed: ${allowed}). ` +
        `Listen address updated: ${previousAddress} -> ${newAddress}`
      );
    }
  }

  /**
   * Update configured listen address
   */
  updateListenAddress(address: string): void {
    const previousAddress = this.getListenAddress();
    this.configuredListenAddress = address;
    const newAddress = this.getListenAddress();

    if (previousAddress !== newAddress) {
      logger.info(
        `Configured listen address updated: ${address}. ` +
        `Effective listen address: ${previousAddress} -> ${newAddress}`
      );
    }
  }

  /**
   * Get security recommendations based on current configuration
   */
  getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];

    if (!this.authEnabled && this.allowExternalAccess) {
      recommendations.push(
        'CRITICAL: External access is requested but authentication is disabled. This is a security risk.'
      );
    }

    if (this.authEnabled && this.configuredListenAddress === '0.0.0.0') {
      recommendations.push(
        'WARNING: Server is configured to listen on all interfaces. Ensure HTTPS and proper firewall rules.'
      );
    }

    if (this.authEnabled && this.trustedProxies.length === 0 && this.configuredListenAddress !== '127.0.0.1') {
      recommendations.push(
        'INFO: Consider configuring trusted proxies if using a reverse proxy (e.g., nginx, Apache).'
      );
    }

    if (!this.authEnabled) {
      recommendations.push(
        'INFO: For production use, consider enabling authentication to allow secure external access.'
      );
    }

    return recommendations;
  }

  /**
   * Validate listen address format
   */
  validateListenAddress(address: string): boolean {
    // Basic IP address validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    // Allow special cases
    if (address === 'localhost' || address === '0.0.0.0' || address === '::') {
      return true;
    }

    return ipv4Regex.test(address) || ipv6Regex.test(address);
  }

  /**
   * Get current security status summary
   */
  getSecurityStatus(): {
    authEnabled: boolean;
    allowExternalAccess: boolean;
    listenAddress: string;
    effectiveListenAddress: string;
    securityLevel: 'high' | 'medium' | 'low';
    recommendations: string[];
  } {
    let securityLevel: 'high' | 'medium' | 'low' = 'high';

    if (!this.authEnabled && this.allowExternalAccess) {
      securityLevel = 'low';
    } else if (!this.authEnabled) {
      securityLevel = 'medium';
    } else if (this.authEnabled && this.configuredListenAddress === '0.0.0.0') {
      securityLevel = 'medium';
    }

    return {
      authEnabled: this.authEnabled,
      allowExternalAccess: this.allowExternalAccess,
      listenAddress: this.configuredListenAddress,
      effectiveListenAddress: this.getListenAddress(),
      securityLevel,
      recommendations: this.getSecurityRecommendations()
    };
  }
}

// Singleton instance
export const listenAddressSecurityManager = new ListenAddressSecurityManager();
