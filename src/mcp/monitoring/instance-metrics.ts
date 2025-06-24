export interface MCPInstanceMetric {
  instanceId: string;
  userId?: string;
  timestamp: Date;
  type: 'access' | 'memory' | 'cpu';
  value: number;
}

export interface InstanceSummary {
  totalInstances: number;
  totalAccesses: number;
  activeUsers: number;
  averageMemoryUsage: number;
  averageCpuUsage: number;
}

export class InstanceMetrics {
  private metrics: Map<string, MCPInstanceMetric[]> = new Map();

  recordInstanceAccess(instanceId: string, userId?: string): void {
    const metric: MCPInstanceMetric = {
      instanceId,
      userId,
      timestamp: new Date(),
      type: 'access',
      value: 1
    };
    this.addMetric(instanceId, metric);
  }

  recordResourceUsage(instanceId: string, memoryMB: number, cpuPercent: number): void {
    const memoryMetric: MCPInstanceMetric = {
      instanceId,
      timestamp: new Date(),
      type: 'memory',
      value: memoryMB
    };
    const cpuMetric: MCPInstanceMetric = {
      instanceId,
      timestamp: new Date(),
      type: 'cpu',
      value: cpuPercent
    };
    this.addMetric(instanceId, memoryMetric);
    this.addMetric(instanceId, cpuMetric);
  }

  getInstanceMetrics(instanceId: string): MCPInstanceMetric[] {
    return this.metrics.get(instanceId) || [];
  }

  getAggregatedMetrics(): InstanceSummary {
    const totalInstances = this.metrics.size;
    const totalAccesses = Array.from(this.metrics.values())
      .flat()
      .filter(m => m.type === 'access').length;
    return {
      totalInstances,
      totalAccesses,
      activeUsers: this.getUniqueUsers().length,
      averageMemoryUsage: this.calculateAverageMetric('memory'),
      averageCpuUsage: this.calculateAverageMetric('cpu')
    };
  }

  private addMetric(instanceId: string, metric: MCPInstanceMetric): void {
    if (!this.metrics.has(instanceId)) {
      this.metrics.set(instanceId, []);
    }
    const instanceMetrics = this.metrics.get(instanceId)!;
    instanceMetrics.push(metric);
    if (instanceMetrics.length > 1000) {
      instanceMetrics.splice(0, 100);
    }
  }

  private getUniqueUsers(): string[] {
    const users = new Set<string>();
    for (const metrics of this.metrics.values()) {
      metrics.forEach(m => {
        if (m.userId) users.add(m.userId);
      });
    }
    return Array.from(users);
  }

  private calculateAverageMetric(type: 'memory' | 'cpu'): number {
    let total = 0;
    let count = 0;
    for (const metrics of this.metrics.values()) {
      metrics.forEach(m => {
        if (m.type === type) {
          total += m.value;
          count += 1;
        }
      });
    }
    return count === 0 ? 0 : total / count;
  }
}
