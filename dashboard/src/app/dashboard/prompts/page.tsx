"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, MessageSquare, Trash2, UserCircle, Cpu, RefreshCw } from "lucide-react";
import { api, type ChannelPrompt, type ChannelProvider, type BotStatus, type ProviderItem, type DiscordChannel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PromptsPage() {
  const { data: session } = useSession();
  const [prompts, setPrompts] = useState<ChannelPrompt[]>([]);
  const [channelProviders, setChannelProviders] = useState<ChannelProvider[]>([]);
  const [availableProviders, setAvailableProviders] = useState<ProviderItem[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [channelId, setChannelId] = useState("");
  const [guildId, setGuildId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  // Fetch channels when guild changes
  useEffect(() => {
    if (token && guildId) {
      fetchChannels(guildId);
    }
  }, [token, guildId]);

  async function fetchData() {
    try {
      const [promptsRes, providersRes, availableRes, statusRes] = await Promise.all([
        api.getChannelPrompts(token!),
        api.getChannelProviders(token!),
        api.getProviders(token!),
        api.getBotStatus(token!),
      ]);
      setPrompts(promptsRes.prompts);
      setChannelProviders(providersRes.providers);
      setAvailableProviders(availableRes.providers);
      setBotStatus(statusRes);
      if (statusRes.guilds.length > 0 && !guildId) {
        setGuildId(statusRes.guilds[0].id);
      }
    } catch (err) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchChannels(gid: string) {
    setChannelsLoading(true);
    try {
      const res = await api.getGuildChannels(token!, gid);
      setChannels(res.channels);
      if (res.channels.length > 0) {
        setChannelId(res.channels[0].id);
      }
    } catch (err) {
      toast.error("Failed to load channels for guild");
    } finally {
      setChannelsLoading(false);
    }
  }

  async function handleAddPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !channelId || !guildId) return;

    setSubmitting(true);
    try {
      await api.setChannelPrompt(token, {
        channel_id: channelId,
        guild_id: guildId,
        system_prompt: systemPrompt,
      });
      toast.success("Channel persona saved");
      setPromptOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error("Failed to save persona");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddProvider(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !channelId || !guildId) return;

    setSubmitting(true);
    try {
      await api.setChannelProvider(token, {
        channel_id: channelId,
        guild_id: guildId,
        provider_name: selectedProvider,
      });
      toast.success("Channel provider override saved");
      setProviderOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error("Failed to save provider override");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePrompt(id: string) {
    if (!token || !confirm("Remove the custom persona for this channel?")) return;
    try {
      await api.deleteChannelPrompt(token, id);
      toast.success("Persona removed");
      fetchData();
    } catch (err) {
      toast.error("Failed to remove persona");
    }
  }

  async function handleDeleteProvider(id: string) {
    if (!token || !confirm("Remove the provider override for this channel?")) return;
    try {
      await api.deleteChannelProvider(token, id);
      toast.success("Provider override removed");
      fetchData();
    } catch (err) {
      toast.error("Failed to remove override");
    }
  }

  function resetForm() {
    setSystemPrompt("");
    setSelectedProvider("");
    // Keep guild and channel if already selected
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Channel Settings</h1>
          <p className="text-muted-foreground text-sm">Configure per-channel personas and AI provider overrides.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="personas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="personas" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" /> Personas
          </TabsTrigger>
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" /> Providers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personas" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" /> Add Persona
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <form onSubmit={handleAddPrompt}>
                  <DialogHeader>
                    <DialogTitle>Add Channel Persona</DialogTitle>
                    <DialogDescription>
                      Custom system prompt for all interactions in this specific channel.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="guild-p">Select Server</Label>
                      <select 
                        id="guild-p" 
                        value={guildId} 
                        onChange={e => setGuildId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {botStatus?.guilds.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="channel-p">Select Channel</Label>
                      <select 
                        id="channel-p" 
                        value={channelId} 
                        onChange={e => setChannelId(e.target.value)}
                        disabled={channelsLoading || channels.length === 0}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {channelsLoading ? <option>Loading...</option> : 
                         channels.length === 0 ? <option>No channels found</option> :
                         channels.map(c => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="prompt">System Prompt</Label>
                      <Textarea id="prompt" value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={6} required />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={submitting || !channelId}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Persona
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-purple-600" />
                Active Personas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prompts.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">No channel personas found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel ID</TableHead>
                      <TableHead>System Prompt</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prompts.map((p) => (
                      <TableRow key={p.channel_id}>
                        <TableCell className="font-mono text-xs">{p.channel_id}</TableCell>
                        <TableCell><p className="text-xs line-clamp-2">{p.system_prompt}</p></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeletePrompt(p.channel_id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" /> Add Provider Override
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddProvider}>
                  <DialogHeader>
                    <DialogTitle>Override Provider</DialogTitle>
                    <DialogDescription>
                      Force a specific AI provider for all interactions in this channel.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="guild-pr">Select Server</Label>
                      <select 
                        id="guild-pr" 
                        value={guildId} 
                        onChange={e => setGuildId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {botStatus?.guilds.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="channel-pr">Select Channel</Label>
                      <select 
                        id="channel-pr" 
                        value={channelId} 
                        onChange={e => setChannelId(e.target.value)}
                        disabled={channelsLoading || channels.length === 0}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {channelsLoading ? <option>Loading...</option> : 
                         channels.length === 0 ? <option>No channels found</option> :
                         channels.map(c => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Forced AI Provider</Label>
                      <RadioGroup value={selectedProvider} onValueChange={setSelectedProvider} className="flex flex-col gap-2">
                        {availableProviders.map(p => (
                          <div key={p.name} className="flex items-center space-x-2 border p-2 rounded hover:bg-accent cursor-pointer">
                            <RadioGroupItem value={p.name} id={`p-${p.name}`} disabled={!p.configured} />
                            <Label htmlFor={`p-${p.name}`} className="flex-1 cursor-pointer">{p.display_name} ({p.model})</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={submitting || !selectedProvider || !channelId}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Override
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-600" />
                Active Provider Overrides
              </CardTitle>
            </CardHeader>
            <CardContent>
              {channelProviders.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">No provider overrides found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel ID</TableHead>
                      <TableHead>Forced Provider</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channelProviders.map((cp) => (
                      <TableRow key={cp.channel_id}>
                        <TableCell className="font-mono text-xs">{cp.channel_id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <Cpu className="h-3 w-3" /> {cp.provider_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteProvider(cp.channel_id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
