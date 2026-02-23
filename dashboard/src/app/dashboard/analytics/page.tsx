"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api, AnalyticsSummary, AnalyticsEvent, BotStatus } from "@/lib/api";
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
import { Loader2, TrendingUp, Cpu, Hash, Clock, History } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [history, setHistory] = useState<AnalyticsEvent[]>([]);
  const [channelMap, setChannelMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const [summaryData, historyData, status] = await Promise.all([
          api.getAnalyticsSummary(token),
          api.getAnalyticsHistory(token, 10),
          api.getBotStatus(token),
        ]);
        
        setSummary(summaryData);
        setHistory(historyData.history);

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
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) return null;

  // Prepare data for Top Channels bar chart with names
  const mappedTopChannels = summary.top_channels.map(c => ({
    ...c,
    displayName: channelMap[c.channel_id] || c.channel_id
  }));

  return (
    <div className="space-y-6 pb-12">
      <h1 className="text-2xl font-bold">Analytics & Usage</h1>

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
            <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.provider_usage.length}</div>
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
        {/* Messages Per Day */}
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
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Provider Usage */}
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
                  label={({ provider }) => provider}
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

        {/* Top Channels */}
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
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average Latency */}
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

      {/* Recent History */}
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
                  <div className="text-xs font-mono">{event.latency_ms ? `${event.latency_ms}ms` : "-"}</div>
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
