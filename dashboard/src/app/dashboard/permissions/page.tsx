"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Shield, Trash2, Lock, RefreshCw } from "lucide-react";
import { api, type CommandPermission, type BotStatus, type DiscordRole } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function PermissionsPage() {
  const { data: session } = useSession();
  const [permissions, setPermissions] = useState<CommandPermission[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
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
    } catch (err) {
      toast.error("Failed to fetch bot status");
      setLoading(false);
    }
  }

  async function fetchGuildData(guildId: string) {
    setLoading(true);
    try {
      const [perms, rolesRes] = await Promise.all([
        api.getPermissions(token!, guildId),
        api.getGuildRoles(token!, guildId)
      ]);
      setPermissions(perms.permissions);
      setRoles(rolesRes.roles);
    } catch (err) {
      toast.error("Failed to fetch guild permissions");
    } finally {
      setLoading(false);
    }
  }

  // Form state
  const [commandName, setCommandName] = useState("");
  const [roleId, setRoleId] = useState("");

  const currentGuildName = botStatus?.guilds.find(g => g.id === selectedGuildId)?.name || selectedGuildId;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedGuildId || !roleId || !commandName) return;

    setSubmitting(true);
    try {
      await api.addPermission(token, {
        command_name: commandName,
        guild_id: selectedGuildId,
        role_id: roleId,
      });
      toast.success("Permission added");
      setOpen(false);
      setCommandName("");
      setRoleId("");
      fetchGuildData(selectedGuildId);
    } catch (err) {
      toast.error("Failed to add permission");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(cmd: string, gid: string, rid: string) {
    if (!token || !confirm("Are you sure you want to remove this restriction?")) return;

    try {
      await api.removePermission(token, cmd, gid, rid);
      toast.success("Restriction removed");
      fetchGuildData(selectedGuildId);
    } catch (err) {
      toast.error("Failed to remove permission");
    }
  }

  const getRoleName = (id: string) => roles.find(r => r.id === id)?.name || id;

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
          <h1 className="text-2xl font-bold">Command Permissions</h1>
          <p className="text-muted-foreground text-sm">Restrict commands for {currentGuildName}.</p>
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

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Restriction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAdd}>
                <DialogHeader>
                  <DialogTitle>Restrict Command</DialogTitle>
                  <DialogDescription>
                    Adding restriction for <strong>{currentGuildName}</strong>.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="command">Command Name</Label>
                    <Select value={commandName} onValueChange={setCommandName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a command" />
                      </SelectTrigger>
                      <SelectContent>
                        {botStatus?.commands?.map(c => (
                          <SelectItem key={c} value={c}>/{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Select Role</Label>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting || !commandName || !roleId}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Restriction
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            Active Restrictions
          </CardTitle>
          <CardDescription>
            Only specified roles can use these commands in {currentGuildName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : permissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Lock className="h-8 w-8 text-muted-foreground mb-2 opacity-20" />
              <p className="text-sm text-muted-foreground">No command restrictions found for this server.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Command</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((perm, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">/{perm.command_name}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getRoleName(perm.role_id)}
                      <span className="text-[10px] text-muted-foreground block font-mono">{perm.role_id}</span>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(perm.command_name, perm.guild_id, perm.role_id)}
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
