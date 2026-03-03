"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Search } from "lucide-react";
import { api, type ChannelItem, type BotStatus, type DiscordChannel } from "@/lib/api";
import { ChannelList } from "@/components/conversations/channel-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ConversationsPage() {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<ChannelItem[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [guildChannels, setGuildChannels] = useState<DiscordChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuildId, setSelectedGuildId] = useState<string>("");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (token) {
      fetchInitialData();
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedGuildId) {
      fetchGuildChannels(selectedGuildId);
    }
  }, [token, selectedGuildId]);

  async function fetchInitialData() {
    try {
      const [status, convs] = await Promise.all([
        api.getBotStatus(token!),
        api.getConversations(token!)
      ]);
      setBotStatus(status);
      setConversations(convs.channels);
      if (status.guilds.length > 0 && !selectedGuildId) {
        setSelectedGuildId(status.guilds[0].id);
      }
    } catch (err) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchGuildChannels(guildId: string) {
    try {
      const res = await api.getGuildChannels(token!, guildId);
      setGuildChannels(res.channels);
    } catch (err) {
      console.error("Failed to load guild channels");
    }
  }

  async function handleDelete(channelId: string) {
    if (!token) return;
    try {
      await api.deleteConversation(token, channelId);
      toast.success(`Cleared conversation history`);
      const convs = await api.getConversations(token);
      setConversations(convs.channels);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  // Filter conversations to only show those belonging to the selected guild
  const filteredConversations = conversations.filter(c => 
    guildChannels.some(gc => gc.id === c.channel_id)
  );

  // Map channel names for display
  const mappedConversations = filteredConversations.map(c => ({
    ...c,
    displayName: guildChannels.find(gc => gc.id === c.channel_id)?.name ? `#${guildChannels.find(gc => gc.id === c.channel_id)?.name}` : c.channel_id
  }));

  const currentGuildName = botStatus?.guilds.find(g => g.id === selectedGuildId)?.name || selectedGuildId;

  if (loading && !botStatus) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Conversations</h1>
          <p className="text-muted-foreground text-sm">View message history for {currentGuildName}.</p>
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
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Channels</CardTitle>
        </CardHeader>
        <CardContent>
          {mappedConversations.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Search className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
              <p className="text-sm text-muted-foreground">No active conversations found for this server.</p>
            </div>
          ) : (
            <ChannelList channels={mappedConversations as any} onDelete={handleDelete} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
