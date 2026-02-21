"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, MessageSquare, Trash2, Cpu, Settings2 } from "lucide-react";
import { api, type ChannelOverride, type ProviderItem } from "@/lib/api";
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

export default function ChannelsPage() {
  const { data: session } = useSession();
  const [overrides, setOverrides] = useState<ChannelOverride[]>([]);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [channelId, setChannelId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [providerName, setProviderName] = useState("default");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  async function fetchData() {
    try {
      const [overridesRes, providersRes] = await Promise.all([
        api.getChannelOverrides(token!),
        api.getProviders(token!),
      ]);
      setOverrides(overridesRes.overrides);
      setProviders(providersRes.providers);
    } catch (err) {
      toast.error("Failed to fetch channel data");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    try {
      await api.setChannelOverride(token, {
        channel_id: channelId,
        system_prompt: systemPrompt || null,
        provider_name: providerName === "default" ? null : providerName,
      });
      toast.success("Channel override saved");
      setOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error("Failed to save override");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token || !confirm("Remove all overrides for this channel?")) return;

    try {
      await api.deleteChannelOverride(token, id);
      toast.success("Overrides removed");
      fetchData();
    } catch (err) {
      toast.error("Failed to remove overrides");
    }
  }

  function resetForm() {
    setChannelId("");
    setSystemPrompt("");
    setProviderName("default");
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
          <p className="text-muted-foreground text-sm">Configure per-channel system prompts and AI provider overrides.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Override
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleAdd}>
              <DialogHeader>
                <DialogTitle>Channel Override</DialogTitle>
                <DialogDescription>
                  Custom settings for a specific channel. These will take priority over global settings.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="channel">Channel ID</Label>
                  <Input 
                    id="channel" 
                    placeholder="Discord Channel ID" 
                    value={channelId} 
                    onChange={e => setChannelId(e.target.value)}
                    required 
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="prompt">Custom System Prompt</Label>
                  <Textarea 
                    id="prompt" 
                    placeholder="Leave empty to use global prompt..." 
                    value={systemPrompt} 
                    onChange={e => setSystemPrompt(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Forced Provider</Label>
                  <RadioGroup value={providerName} onValueChange={setProviderName} className="grid grid-cols-2 gap-2 mt-1">
                    <div className="flex items-center space-x-2 border p-2 rounded cursor-pointer hover:bg-accent">
                      <RadioGroupItem value="default" id="prov-default" />
                      <Label htmlFor="prov-default" className="flex-1 cursor-pointer">Use Global Default</Label>
                    </div>
                    {providers.map(p => (
                      <div key={p.name} className="flex items-center space-x-2 border p-2 rounded cursor-pointer hover:bg-accent">
                        <RadioGroupItem value={p.name} id={`prov-${p.name}`} disabled={!p.configured} />
                        <Label htmlFor={`prov-${p.name}`} className={`flex-1 cursor-pointer ${!p.configured ? 'opacity-50' : ''}`}>
                          {p.display_name}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
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
            <Settings2 className="h-4 w-4 text-blue-600" />
            Active Overrides
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No channel-specific overrides found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel ID</TableHead>
                  <TableHead>System Prompt</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((ov) => (
                  <TableRow key={ov.channel_id}>
                    <TableCell className="font-mono text-xs">{ov.channel_id}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-xs truncate">{ov.system_prompt || <span className="italic text-muted-foreground">Global Default</span>}</p>
                    </TableCell>
                    <TableCell>
                      {ov.provider_name ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Cpu className="h-3 w-3" />
                          {ov.provider_name}
                        </Badge>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">Global Default</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(ov.channel_id)}
                      >
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
    </div>
  );
}
