import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mcpBridgeService } from '../services/mcpBridge';
import type { MCPServerConfig, GlobalConfig } from '../types';

// Query Keys
export const queryKeys = {
  servers: ['servers'],
  server: (id: string) => ['servers', id],
  tools: ['tools'],
  toolAliases: ['toolAliases'],
  globalConfig: ['globalConfig'],
  stats: ['stats'],
  logs: ['logs'],
};

// Server Queries
export const useServers = () => {
  return useQuery({
    queryKey: queryKeys.servers,
    queryFn: mcpBridgeService.getServers,
    refetchInterval: 5000, // Refresh every 5 seconds
  });
};

export const useServerStatus = (serverId: string) => {
  return useQuery({
    queryKey: queryKeys.server(serverId),
    queryFn: () => mcpBridgeService.getServerStatus(serverId),
    refetchInterval: 2000, // Refresh every 2 seconds
  });
};

// Tool Queries
export const useTools = () => {
  return useQuery({
    queryKey: queryKeys.tools,
    queryFn: mcpBridgeService.getTools,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
};

export const useToolAliases = () => {
  return useQuery({
    queryKey: queryKeys.toolAliases,
    queryFn: mcpBridgeService.getToolAliases,
  });
};

// Global Config Query
export const useGlobalConfig = () => {
  return useQuery({
    queryKey: queryKeys.globalConfig,
    queryFn: mcpBridgeService.getGlobalConfig,
  });
};

// Stats Query
export const useStats = () => {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: mcpBridgeService.getStats,
    refetchInterval: 5000, // Refresh every 5 seconds
  });
};

// Server Mutations
export const useAddServer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ serverId, config }: { serverId: string; config: MCPServerConfig }) =>
      mcpBridgeService.addServer(serverId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
};

export const useUpdateServer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ serverId, config }: { serverId: string; config: MCPServerConfig }) =>
      mcpBridgeService.updateServer(serverId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
    },
  });
};

export const useRemoveServer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (serverId: string) => mcpBridgeService.removeServer(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: queryKeys.tools });
    },
  });
};

export const useRetryServer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (serverId: string) => mcpBridgeService.retryServer(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
    },
  });
};

export const useRetryAllServers = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => mcpBridgeService.retryAllServers(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
    },
  });
};

// Tool Mutations
export const useCreateToolAlias = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ alias, originalName, serverId }: { alias: string; originalName: string; serverId: string }) =>
      mcpBridgeService.createToolAlias(alias, originalName, serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.toolAliases });
      queryClient.invalidateQueries({ queryKey: queryKeys.tools });
    },
  });
};

export const useRemoveToolAlias = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (alias: string) => mcpBridgeService.removeToolAlias(alias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.toolAliases });
      queryClient.invalidateQueries({ queryKey: queryKeys.tools });
    },
  });
};

// Global Config Mutation
export const useUpdateGlobalConfig = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (config: Partial<GlobalConfig>) => mcpBridgeService.updateGlobalConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.globalConfig });
    },
  });
};
