"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api, AnalyticsSummary, AnalyticsEvent, BotStatus, UsageResponse, CostSummary, ProvidersResponse } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Loader2, TrendingUp, Cpu, Hash, Clock, History, RefreshCw, DollarSign, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [history, setHistory] = useState<AnalyticsEvent[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [costs, setCosts] = useState<CostSummary | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [providersData, setProvidersData] = useState<ProvidersResponse | null>(null);
  const [channelMap, setChannelMap] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedGuildId, setSelectedGuildId] = useState<string>("all");
  const [chartPrimaryColor, setChartPrimaryColor] = useState<string>("#8884d8"); // Fallback color

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const computedStyle = window.getComputedStyle(document.documentElement);
      const primaryColor = computedStyle.getPropertyValue('--primary').trim();
      if (primaryColor) {
        setChartPrimaryColor(primaryColor);
      }
    }
  }, []); // Run once on mount

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const [status, configData, provs] = await Promise.all([
          api.getBotStatus(token),
          api.getConfig(token),
          api.getProviders(token),
        ]);
        
        setBotStatus(status);
        setConfig(configData.config);
        setProvidersData(provs);

        // Fetch filtered data
        const guildFilter = selectedGuildId === "all" ? undefined : selectedGuildId;
        const [summaryData, historyData, usageData, costData] = await Promise.all([
          api.getAnalyticsSummary(token, guildFilter),
          api.getAnalyticsHistory(token, 10, guildFilter),
          api.getAnalyticsUsage(token, guildFilter),
          api.getAnalyticsCosts(token),
        ]);

        setSummary(summaryData);
        setHistory(historyData.history);
        setUsage(usageData);
        setCosts(costData);

        // Fetch channel names for each guild to build a master map
        const allChannelMaps: Record<string, string> = {};
        await Promise.all(status.guilds.map(async (guild) => {
          try {
            const channelsRes = await api.getGuildChannels(token, guild.id);
            channelsRes.channels.forEach(c => {
              allChannelMaps[c.id] = `#${c.name}`;
            });
          } catch (e) {
            console.error(`Failed to fetch channels for guild ${guild.id}`);
          }
        }));
        setChannelMap(allChannelMaps);
      } catch (err) {
        toast.error("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, selectedGuildId]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) return null;

  const mappedTopChannels = summary.top_channels.map(c => ({
    ...c,
    displayName: channelMap[c.channel_id] || c.channel_id
  }));

  // Filter out non-AI providers from analytics summary
  // Sometimes 'command:ask' etc might be in there if not filtered correctly on backend
  const filteredProviderUsage = summary.provider_usage.filter(p => 
    !p.provider.startsWith("command:")
  );

  const configuredCount = providersData?.providers.filter(p => p.configured).length || 0;
  const activeCount = filteredProviderUsage.length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics & Usage</h1>
          <p className="text-muted-foreground text-sm">
            Monitoring {selectedGuildId === "all" ? "All Servers" : botStatus?.guilds.find(g => g.id === selectedGuildId)?.name}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="guild-select" className="shrink-0 text-sm font-medium">Server:</Label>
          <Select value={selectedGuildId} onValueChange={setSelectedGuildId}>
            <SelectTrigger id="guild-select" className="w-[200px]">
              <SelectValue placeholder="Select a server" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Servers</SelectItem>
              {botStatus?.guilds.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Dashboard</TabsTrigger>
          <TabsTrigger value="quota">Quota Monitoring</TabsTrigger>
          <TabsTrigger value="costs">Cost Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages (30d)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.messages_per_day.reduce((acc, curr) => acc + curr.count, 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Providers (Config / Active)</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {configuredCount} / {activeCount}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
                <Hash className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.top_channels.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Latency</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(
                    summary.avg_latency.reduce((acc, curr) => acc + curr.avg_latency, 0) /
                      (summary.avg_latency.length || 1)
                  )}
                  ms
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Activity Overview</CardTitle>
                <CardDescription>Messages processed per day (last 30 days)</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.messages_per_day}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(val) => format(new Date(val), "MMM d")}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip
                      labelFormatter={(val) => format(new Date(val), "PPPP")}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={chartPrimaryColor}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Provider Distribution</CardTitle>
                <CardDescription>AI provider usage across all requests</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.provider_usage}
                      dataKey="count"
                      nameKey="provider"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ payload }) => payload.provider}
                    >
                      {summary.provider_usage.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Top Channels</CardTitle>
                <CardDescription>Most active channels by message count</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mappedTopChannels} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={12} />
                    <YAxis dataKey="displayName" type="category" fontSize={10} width={100} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Bar dataKey="count" fill={chartPrimaryColor} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Response Latency</CardTitle>
                <CardDescription>Average AI response time in ms</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.avg_latency}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(val) => format(new Date(val), "MMM d")}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} unit="ms" />
                    <Tooltip
                      labelFormatter={(val) => format(new Date(val), "PPPP")}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg_latency"
                      name="Avg Latency"
                      stroke="#FF8042"
                      strokeWidth={2}
                      dot={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quota" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Active User Limits</CardTitle>
                <CardDescription>Current requests in the last 60 seconds (Limit: {config.RATE_LIMIT_USER || 5}/min)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.keys(usage?.user_usage || {}).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No active user sessions</p>
                ) : (
                  Object.entries(usage?.user_usage || {}).map(([uid, count]) => {
                    const limit = Number(config.RATE_LIMIT_USER) || 5;
                    const percent = Math.min(100, (count / limit) * 100);
                    return (
                      <div key={uid} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono">User ID: {uid}</span>
                          <span>{count} / {limit} req</span>
                        </div>
                        <Progress value={percent} className={percent > 80 ? "bg-red-100 [&>div]:bg-red-500" : ""} />
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Server Limits</CardTitle>
                <CardDescription>Current requests in the last 60 seconds (Limit: {config.RATE_LIMIT_GUILD || 20}/min)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.keys(usage?.guild_usage || {}).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No active server sessions</p>
                ) : (
                  Object.entries(usage?.guild_usage || {}).map(([gid, count]) => {
                    const limit = Number(config.RATE_LIMIT_GUILD) || 20;
                    const percent = Math.min(100, (count / limit) * 100);
                    const guildName = botStatus?.guilds.find(g => g.id === gid)?.name || gid;
                    return (
                      <div key={gid} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{guildName}</span>
                          <span>{count} / {limit} req</span>
                        </div>
                        <Progress value={percent} className={percent > 80 ? "bg-red-100 [&>div]:bg-red-500" : ""} />
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Lifetime Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-1">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  {costs?.total_cost.toFixed(4)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Estimated USD</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Daily Avg (Last 30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${((costs?.total_cost || 0) / (costs?.daily_costs.length || 1)).toFixed(4)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Projected Monthly</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  ${(((costs?.total_cost || 0) / (costs?.daily_costs.length || 1)) * 30).toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cost by Provider</CardTitle>
                <CardDescription>Financial distribution across AI models</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costs?.provider_costs}
                      dataKey="cost"
                      nameKey="provider"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ provider, cost }) => `${provider}: $${cost.toFixed(3)}`}
                    >
                      {costs?.provider_costs.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => `$${val.toFixed(4)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Expenditure</CardTitle>
                <CardDescription>Cost trends over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costs?.daily_costs}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      tickFormatter={(val) => format(new Date(val), "MMM d")}
                      fontSize={12} 
                    />
                    <YAxis fontSize={12} tickFormatter={(val) => `$${val.toFixed(2)}`} />
                    <Tooltip 
                      labelFormatter={(val) => format(new Date(val), "PPPP")}
                      formatter={(val: number) => [`$${val.toFixed(4)}`, "Cost"]}
                    />
                    <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest tracked events from the bot</CardDescription>
            </div>
            <History className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {history.map((event) => (
              <div key={event.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded capitalize">
                      {event.event_type}
                    </span>
                    <span className="text-sm font-medium">{event.provider || "N/A"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    User: {event.user_id || "System"} • Channel: {event.channel_id ? (channelMap[event.channel_id] || event.channel_id) : "N/A"}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs font-mono">
                    {event.estimated_cost ? (
                      <span className="text-green-600 font-medium">${event.estimated_cost.toFixed(4)}</span>
                    ) : (
                      event.latency_ms ? `${event.latency_ms}ms` : "-"
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {format(new Date(event.created_at), "HH:mm:ss MMM d")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
