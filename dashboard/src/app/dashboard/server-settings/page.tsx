"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Save, RefreshCw, Server, MessageSquare, AlertTriangle, Clock } from "lucide-react";
import { api, type BotStatus, type DiscordChannel, type ServerConfig } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export default function ServerSettingsPage() {
  const { data: session } = useSession();
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(false);
  
  const [selectedGuildId, setSelectedGuildId] = useState<string>("");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (token) {
      fetchInitialData();
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedGuildId) {
      fetchServerData(selectedGuildId);
    }
  }, [token, selectedGuildId]);

  async function fetchInitialData() {
    try {
      const status = await api.getBotStatus(token!);
      setBotStatus(status);
      if (status.guilds.length > 0) {
        setSelectedGuildId(status.guilds[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      toast.error("Failed to fetch bot status");
      setLoading(false);
    }
  }

  async function fetchServerData(guildId: string) {
    setChannelsLoading(true);
    try {
      const [channelsRes, configRes] = await Promise.all([
        api.getGuildChannels(token!, guildId),
        api.getServerSettings(token!, guildId)
      ]);
      setChannels(channelsRes.channels);
      setConfig(configRes);
    } catch (err) {
      toast.error("Failed to fetch server settings");
    } finally {
      setChannelsLoading(false);
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!token || !selectedGuildId || !config) return;
    setSaving(true);
    try {
      await api.updateServerSettings(token, selectedGuildId, config);
      toast.success("Server settings updated successfully");
    } catch (err) {
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!botStatus || botStatus.guilds.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
        <h2 className="text-xl font-semibold">No Servers Found</h2>
        <p className="text-muted-foreground">The bot needs to be invited to at least one server to configure these settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Server Settings</h1>
          <p className="text-muted-foreground text-sm">Configure features for a specific Discord server.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="guild-select" className="shrink-0">Server:</Label>
          <Select value={selectedGuildId} onValueChange={setSelectedGuildId}>
            <SelectTrigger id="guild-select" className="w-[240px]">
              <SelectValue placeholder="Select a server" />
            </SelectTrigger>
            <SelectContent>
              {botStatus.guilds.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => fetchServerData(selectedGuildId)} disabled={channelsLoading}>
            <RefreshCw className={`h-4 w-4 ${channelsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {!config ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6 pb-12">
          {/* Onboarding */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Server className="h-5 w-5 text-blue-500" />
                    Member Onboarding
                  </CardTitle>
                  <CardDescription>Automatically greet new members when they join.</CardDescription>
                </div>
                <Switch 
                  checked={config.welcome_enabled} 
                  onCheckedChange={(val) => setConfig({...config, welcome_enabled: val})} 
                />
              </div>
            </CardHeader>
            {config.welcome_enabled && (
              <CardContent className="space-y-4 pt-0">
                <Separator className="mb-4" />
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Welcome Channel</Label>
                    <Select 
                      value={config.welcome_channel_id || ""} 
                      onValueChange={(val) => setConfig({...config, welcome_channel_id: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map(c => (
                          <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Welcome Message</Label>
                    <Textarea 
                      value={config.welcome_message || ""} 
                      onChange={e => setConfig({...config, welcome_message: e.target.value})}
                      placeholder="Welcome {user} to {server}!"
                      rows={3}
                    />
                    <p className="text-[10px] text-muted-foreground">Use <code>{'{user}'}</code> and <code>{'{server}'}</code> as placeholders.</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Daily Digest */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                    Daily Digest
                  </CardTitle>
                  <CardDescription>AI-generated summary of server activity posted daily.</CardDescription>
                </div>
                <Switch 
                  checked={config.digest_enabled} 
                  onCheckedChange={(val) => setConfig({...config, digest_enabled: val})} 
                />
              </div>
            </CardHeader>
            {config.digest_enabled && (
              <CardContent className="space-y-4 pt-0">
                <Separator className="mb-4" />
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Post to Channel</Label>
                    <Select 
                      value={config.digest_channel_id || ""} 
                      onValueChange={(val) => setConfig({...config, digest_channel_id: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map(c => (
                          <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Post Time (24h)
                    </Label>
                    <Input 
                      type="text" 
                      placeholder="09:00" 
                      value={config.digest_time || "09:00"} 
                      onChange={e => setConfig({...config, digest_time: e.target.value})}
                      className="w-32"
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Moderation */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    AI Moderation
                  </CardTitle>
                  <CardDescription>Flag potentially toxic messages for review.</CardDescription>
                </div>
                <Switch 
                  checked={config.moderation_enabled} 
                  onCheckedChange={(val) => setConfig({...config, moderation_enabled: val})} 
                />
              </div>
            </CardHeader>
            {config.moderation_enabled && (
              <CardContent className="space-y-4 pt-0">
                <Separator className="mb-4" />
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mod Log Channel</Label>
                    <Select 
                      value={config.mod_log_channel_id || ""} 
                      onValueChange={(val) => setConfig({...config, mod_log_channel_id: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map(c => (
                          <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sensitivity</Label>
                    <RadioGroup 
                      value={config.moderation_sensitivity || "medium"} 
                      onValueChange={(val) => setConfig({...config, moderation_sensitivity: val})}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="low" id="s-low" />
                        <Label htmlFor="s-low" className="font-normal cursor-pointer">Low (Flag only severe toxicity)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="medium" id="s-med" />
                        <Label htmlFor="s-med" className="font-normal cursor-pointer">Medium (Standard protection)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="high" id="s-high" />
                        <Label htmlFor="s-high" className="font-normal cursor-pointer">High (Strict monitoring)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save All Server Settings
          </Button>
        </div>
      )}
    </div>
  );
}
