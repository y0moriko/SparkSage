"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Activity, Cpu, Wifi, WifiOff, Server, ArrowRight, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { BotStatus, ProvidersResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardOverview() {
  const { data: session } = useSession();
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [providersData, setProvidersData] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  const token = (session as { accessToken?: string })?.accessToken;

  const fetchStatus = useCallback(async (isInitial = false) => {
    if (!token) return;
    if (!isInitial) setIsPolling(true);
    
    try {
      const status = await api.getBotStatus(token);
      setBotStatus(status);
    } catch (err) {
      console.error("Failed to fetch bot status:", err);
    } finally {
      if (isInitial) setLoading(false);
      setIsPolling(false);
    }
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [botResult, provResult] = await Promise.allSettled([
        api.getBotStatus(token),
        api.getProviders(token),
      ]);
      if (botResult.status === "fulfilled") setBotStatus(botResult.value);
      if (provResult.status === "fulfilled") setProvidersData(provResult.value);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling for bot status every 10 seconds
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => fetchStatus(), 10000);
    return () => clearInterval(interval);
  }, [token, fetchStatus]);

  const primaryProvider = providersData?.providers.find((p) => p.is_primary);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex items-center gap-2">
          {isPolling && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Auto-refreshing every 10s
          </span>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
            {botStatus?.online ? (
              <div className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant={botStatus?.online ? "success" : "secondary"}>
                  {botStatus?.online ? "Online" : "Offline"}
                </Badge>
                {botStatus?.online && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {botStatus.latency_ms != null ? `Live` : ""}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Latency</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {botStatus?.latency_ms != null
                ? `${Math.round(botStatus.latency_ms)}ms`
                : "--"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Servers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{botStatus?.guild_count ?? "--"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Provider</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {primaryProvider ? (
              <div>
                <p className="text-lg font-semibold">{primaryProvider.display_name}</p>
                <p className="text-xs text-muted-foreground">{primaryProvider.model}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">--</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fallback chain */}
      {providersData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fallback Chain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {providersData.fallback_order.map((name, i) => {
                const prov = providersData.providers.find((p) => p.name === name);
                return (
                  <div key={name} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          prov?.configured ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <span className="text-sm">{prov?.display_name || name}</span>
                      {prov?.is_primary && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                    {i < providersData.fallback_order.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
