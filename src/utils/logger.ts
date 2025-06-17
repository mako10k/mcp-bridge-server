/**
 * Logger utility for MCP Bridge Server
 */

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  args?: any[];
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  getLogs(limit?: number): LogEntry[];
  clearLogs(): void;
}

class SimpleLogger implements Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 log entries

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  private addLogEntry(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, args?: any[]): void {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      args: args && args.length > 0 ? args : undefined
    };

    this.logs.push(logEntry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  info(message: string, ...args: any[]): void {
    console.log(this.formatMessage('INFO', message), ...args);
    this.addLogEntry('INFO', message, args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('WARN', message), ...args);
    this.addLogEntry('WARN', message, args);
  }

  error(message: string, ...args: any[]): void {
    console.error(this.formatMessage('ERROR', message), ...args);
    this.addLogEntry('ERROR', message, args);
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
    this.addLogEntry('DEBUG', message, args);
  }

  getLogs(limit?: number): LogEntry[] {
    const logs = this.logs.slice(); // Copy array
    return limit ? logs.slice(-limit) : logs;
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const logger = new SimpleLogger();
