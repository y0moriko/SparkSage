"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, MessageSquare, Trash2, Hash, Cpu, RefreshCw } from "lucide-react";
import { api, type ChannelPrompt, type ChannelProvider, type BotStatus, type ProviderItem, type DiscordChannel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [selectedGuildId, setSelectedGuildId] = useState<string>("");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (token) {
      fetchInitialData();
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedGuildId) {
      fetchGuildData(selectedGuildId);
    }
  }, [token, selectedGuildId]);

  async function fetchInitialData() {
    try {
      const status = await api.getBotStatus(token!);
      setBotStatus(status);
      if (status.guilds.length > 0 && !selectedGuildId) {
        setSelectedGuildId(status.guilds[0].id);
      }
      
      const [promptsRes, providersRes, availableRes] = await Promise.all([
        api.getChannelPrompts(token!),
        api.getChannelProviders(token!),
        api.getProviders(token!),
      ]);
      setPrompts(promptsRes.prompts);
      setChannelProviders(providersRes.providers);
      setAvailableProviders(availableRes.providers);
    } catch (err) {
      toast.error("Failed to fetch initial data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchGuildData(guildId: string) {
    setChannelsLoading(true);
    try {
      const res = await api.getGuildChannels(token!, guildId);
      setChannels(res.channels);
    } catch (err) {
      toast.error("Failed to load channels for server");
    } finally {
      setChannelsLoading(false);
    }
  }

  // Form state
  const [channelId, setChannelId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");

  const currentGuildName = botStatus?.guilds.find(g => g.id === selectedGuildId)?.name || selectedGuildId;
  const getChannelName = (id: string) => channels.find(c => c.id === id)?.name ? `#${channels.find(c => c.id === id)?.name}` : id;

  const filteredPrompts = prompts.filter(p => p.guild_id === selectedGuildId);
  const filteredChannelProviders = channelProviders.filter(cp => cp.guild_id === selectedGuildId);

  async function handleAddPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !channelId || !selectedGuildId) return;

    setSubmitting(true);
    try {
      await api.setChannelPrompt(token, {
        channel_id: channelId,
        guild_id: selectedGuildId,
        system_prompt: systemPrompt,
      });
      toast.success("Channel persona saved");
      setPromptOpen(false);
      resetForm();
      const res = await api.getChannelPrompts(token!);
      setPrompts(res.prompts);
    } catch (err) {
      toast.error("Failed to save persona");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddProvider(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !channelId || !selectedGuildId) return;

    setSubmitting(true);
    try {
      await api.setChannelProvider(token, {
        channel_id: channelId,
        guild_id: selectedGuildId,
        provider_name: selectedProvider,
      });
      toast.success("Channel provider override saved");
      setProviderOpen(false);
      resetForm();
      const res = await api.getChannelProviders(token!);
      setChannelProviders(res.providers);
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
      const res = await api.getChannelPrompts(token!);
      setPrompts(res.prompts);
    } catch (err) {
      toast.error("Failed to remove persona");
    }
  }

  async function handleDeleteProvider(id: string) {
    if (!token || !confirm("Remove the provider override for this channel?")) return;
    try {
      await api.deleteChannelProvider(token, id);
      toast.success("Provider override removed");
      const res = await api.getChannelProviders(token!);
      setChannelProviders(res.providers);
    } catch (err) {
      toast.error("Failed to remove override");
    }
  }

  function resetForm() {
    setSystemPrompt("");
    setSelectedProvider("");
    setChannelId("");
  }

  if (loading && !botStatus) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Channel Settings</h1>
          <p className="text-muted-foreground text-sm">Configure personas and providers for {currentGuildName}.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="guild-select" className="shrink-0 text-sm font-medium">Server:</Label>
          <Select value={selectedGuildId} onValueChange={setSelectedGuildId}>
            <SelectTrigger id="guild-select" className="w-[200px]">
              <SelectValue placeholder="Select a server" />
            </SelectTrigger>
            <SelectContent>
              {botStatus?.guilds.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchInitialData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="personas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="personas" className="flex items-center gap-2">
            <Hash className="h-4 w-4" /> Personas
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
                      Persona for <strong>{currentGuildName}</strong>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Select Channel</Label>
                      <Select value={channelId} onValueChange={setChannelId}>
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
                <Hash className="h-4 w-4 text-purple-600" />
                Active Personas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredPrompts.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">No channel personas found for this server.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>System Prompt</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrompts.map((p) => (
                      <TableRow key={p.channel_id}>
                        <TableCell className="text-sm font-medium">
                          {getChannelName(p.channel_id)}
                          <span className="text-[10px] text-muted-foreground block font-mono">{p.channel_id}</span>
                        </TableCell>
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
                      Provider override for <strong>{currentGuildName}</strong>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Select Channel</Label>
                      <Select value={channelId} onValueChange={setChannelId}>
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
              {filteredChannelProviders.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">No provider overrides found for this server.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Forced Provider</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChannelProviders.map((cp) => (
                      <TableRow key={cp.channel_id}>
                        <TableCell className="text-sm font-medium">
                          {getChannelName(cp.channel_id)}
                          <span className="text-[10px] text-muted-foreground block font-mono">{cp.channel_id}</span>
                        </TableCell>
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
