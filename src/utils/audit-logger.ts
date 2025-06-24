import fs from 'fs';
import path from 'path';
import { LogEntry } from './logger.js';

export class AuditLogger {
  private logPath: string;
  constructor(logDir = 'audit-logs') {
    this.logPath = path.join(logDir, `${new Date().toISOString().slice(0,10)}.log`);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(entry: LogEntry) {
    const line = `[${entry.timestamp}] [${entry.level}] ${entry.message}\n`;
    fs.appendFileSync(this.logPath, line);
  }
}

export const auditLogger = new AuditLogger();
