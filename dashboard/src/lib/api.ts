const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers,
    ...rest,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `API error: ${res.status}`);
  }

  return res.json();
}

// Response types matching backend
export interface ProviderItem {
  name: string;
  display_name: string;
  model: string;
  free: boolean;
  configured: boolean;
  is_primary: boolean;
}

export interface ProvidersResponse {
  providers: ProviderItem[];
  fallback_order: string[];
}

export interface ChannelItem {
  channel_id: string;
  message_count: number;
  last_active: string;
}

export interface MessageItem {
  role: string;
  content: string;
  provider: string | null;
  category: string | null;
  created_at: string;
}

export interface BotStatus {
  online: boolean;
  latency_ms: number | null;
  guild_count: number;
  guilds: Array<{ id: string; name: string; member_count: number }>;
  commands?: string[];
  uptime?: number | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: string;
}

export interface DiscordRole {
  id: string;
  name: string;
}

export interface CommandPermission {
  command_name: string;
  guild_id: string;
  role_id: string;
}

export interface TestProviderResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}

export interface FAQItem {
  id: number;
  guild_id: string;
  question: string;
  answer: string;
  match_keywords: string;
  times_used: number;
  created_by: string | null;
  created_at: string;
}

export interface ChannelPrompt {
  channel_id: string;
  guild_id: string;
  system_prompt: string;
}

export interface ChannelProvider {
  channel_id: string;
  guild_id: string;
  provider_name: string;
}

export interface ChannelOverride {
  channel_id: string;
  guild_id: string;
  system_prompt: string | null;
  provider_name: string | null;
}

export interface ServerConfig {
  guild_id: string;
  welcome_enabled: boolean;
  welcome_channel_id: string | null;
  welcome_message: string | null;
  digest_enabled: boolean;
  digest_channel_id: string | null;
  digest_time: string | null;
  moderation_enabled: boolean;
  mod_log_channel_id: string | null;
  moderation_sensitivity: string | null;
}

export interface PluginItem {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  cog: string;
  enabled: boolean;
  path: string;
}

export interface AnalyticsSummary {
  messages_per_day: Array<{ day: string; count: number }>;
  provider_usage: Array<{ provider: string; count: number }>;
  top_channels: Array<{ channel_id: string; count: number }>;
  avg_latency: Array<{ day: string; avg_latency: number }>;
}

export interface UsageResponse {
  user_usage: Record<string, number>;
  guild_usage: Record<string, number>;
}

export interface CostSummary {
  total_cost: number;
  provider_costs: Array<{ provider: string; cost: number }>;
  daily_costs: Array<{ day: string; cost: number }>;
}

export interface AnalyticsEvent {
  id: number;
  event_type: string;
  guild_id: string | null;
  channel_id: string | null;
  user_id: string | null;
  provider: string | null;
  tokens_used: number | null;
  latency_ms: number | null;
  created_at: string;
}

export const api = {
  // Auth
  login: (password: string) =>
    apiFetch<{ access_token: string; token_type: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  me: (token: string) =>
    apiFetch<{ username: string; role: string }>("/api/auth/me", { token }),

  // Config
  getConfig: (token: string) =>
    apiFetch<{ config: Record<string, string> }>("/api/config", { token }),

  updateConfig: (token: string, values: Record<string, string>) =>
    apiFetch<{ status: string }>("/api/config", {
      method: "PUT",
      body: JSON.stringify({ values }),
      token,
    }),

  // Providers
  getProviders: (token: string) =>
    apiFetch<ProvidersResponse>("/api/providers", { token }),

  testProvider: (token: string, provider: string, api_key?: string) =>
    apiFetch<TestProviderResult>("/api/providers/test", {
      method: "POST",
      body: JSON.stringify({ provider, api_key }),
      token,
    }),

  setPrimaryProvider: (token: string, provider: string) =>
    apiFetch<{ status: string; primary: string }>("/api/providers/primary", {
      method: "PUT",
      body: JSON.stringify({ provider }),
      token,
    }),

  // Bot
  getBotStatus: (token: string) =>
    apiFetch<BotStatus>("/api/bot/status", { token }),

  restartBot: (token: string) =>
    apiFetch<{ status: string }>("/api/bot/restart", {
      method: "POST",
      token,
    }),

  getGuildChannels: (token: string, guildId: string) =>
    apiFetch<{ channels: DiscordChannel[] }>(`/api/bot/guilds/${guildId}/channels`, { token }),

  getGuildRoles: (token: string, guildId: string) =>
    apiFetch<{ roles: DiscordRole[] }>(`/api/bot/guilds/${guildId}/roles`, { token }),

  // Conversations
  getConversations: (token: string) =>
    apiFetch<{ channels: ChannelItem[] }>("/api/conversations", { token }),

  getConversation: (token: string, channelId: string) =>
    apiFetch<{ channel_id: string; messages: MessageItem[] }>(
      `/api/conversations/${channelId}`,
      { token }
    ),

  deleteConversation: (token: string, channelId: string) =>
    apiFetch<{ status: string }>(`/api/conversations/${channelId}`, {
      method: "DELETE",
      token,
    }),

  // Wizard
  getWizardStatus: (token: string) =>
    apiFetch<{ completed: boolean; current_step: number }>("/api/wizard/status", { token }),

  completeWizard: (token: string, data: Record<string, string>) =>
    apiFetch<{ status: string }>("/api/wizard/complete", {
      method: "POST",
      body: JSON.stringify({ config: data }),
      token,
    }),

  // FAQs
  getFAQs: (token: string) =>
    apiFetch<{ faqs: FAQItem[] }>("/api/faqs", { token }),

  createFAQ: (token: string, data: Omit<FAQItem, "id" | "times_used" | "created_at" | "created_by">) =>
    apiFetch<{ status: string }>("/api/faqs", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  deleteFAQ: (token: string, id: number) =>
    apiFetch<{ status: string }>(`/api/faqs/${id}`, {
      method: "DELETE",
      token,
    }),

  // Permissions
  getPermissions: (token: string, guildId: string) =>
    apiFetch<{ permissions: CommandPermission[] }>(`/api/permissions/${guildId}`, { token }),

  addPermission: (token: string, data: CommandPermission) =>
    apiFetch<{ status: string }>("/api/permissions", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  removePermission: (token: string, commandName: string, guild_id: string, roleId: string) =>
    apiFetch<{ status: string }>(`/api/permissions?command_name=${commandName}&guild_id=${guild_id}&role_id=${roleId}`, {
      method: "DELETE",
      token,
    }),

  // Prompts
  getChannelPrompts: (token: string) =>
    apiFetch<{ prompts: ChannelPrompt[] }>("/api/prompts/prompts", { token }),

  setChannelPrompt: (token: string, data: ChannelPrompt) =>
    apiFetch<{ status: string }>("/api/prompts/prompts", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  deleteChannelPrompt: (token: string, channelId: string) =>
    apiFetch<{ status: string }>(`/api/prompts/prompts/${channelId}`, {
      method: "DELETE",
      token,
    }),

  // Channel Providers
  getChannelProviders: (token: string) =>
    apiFetch<{ providers: ChannelProvider[] }>("/api/prompts/providers", { token }),

  setChannelProvider: (token: string, data: ChannelProvider) =>
    apiFetch<{ status: string }>("/api/prompts/providers", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  deleteChannelProvider: (token: string, channelId: string) =>
    apiFetch<{ status: string }>(`/api/prompts/providers/${channelId}`, {
      method: "DELETE",
      token,
    }),

  // Overrides (Legacy compatibility if needed)
  getChannelOverrides: (token: string) =>
    apiFetch<{ overrides: ChannelOverride[] }>("/api/channels/overrides", { token }),

  setChannelOverride: (token: string, data: ChannelOverride) =>
    apiFetch<{ status: string }>("/api/channels/overrides", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  deleteChannelOverride: (token: string, channelId: string) =>
    apiFetch<{ status: string }>(`/api/channels/overrides/${channelId}`, {
      method: "DELETE",
      token,
    }),

  // Server Settings
  getServerSettings: (token: string, guildId: string) =>
    apiFetch<ServerConfig>(`/api/server-settings/${guildId}`, { token }),

  updateServerSettings: (token: string, guildId: string, data: Partial<ServerConfig>) =>
    apiFetch<{ status: string }>(`/api/server-settings/${guildId}`, {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    }),

  // Plugins
  getPlugins: (token: string) =>
    apiFetch<{ plugins: PluginItem[] }>("/api/plugins", { token }),

  updatePluginStatus: (token: string, pluginId: string, enabled: boolean) =>
    apiFetch<{ status: string; message: string }>("/api/plugins/status", {
      method: "PUT",
      body: JSON.stringify({ id: pluginId, enabled }),
      token,
    }),

  // Analytics
  getAnalyticsSummary: (token: string, guildId?: string) =>
    apiFetch<AnalyticsSummary>(`/api/analytics/summary${guildId ? `?guild_id=${guildId}` : ""}`, { token }),

  getAnalyticsUsage: (token: string, guildId?: string) =>
    apiFetch<UsageResponse>(`/api/analytics/usage${guildId ? `?guild_id=${guildId}` : ""}`, { token }),

  getAnalyticsCosts: (token: string) =>
    apiFetch<CostSummary>("/api/analytics/costs", { token }),

  getAnalyticsHistory: (token: string, limit: number = 100, guildId?: string) =>
    apiFetch<{ history: AnalyticsEvent[] }>(`/api/analytics/history?limit=${limit}${guildId ? `&guild_id=${guildId}` : ""}`, { token }),
};
