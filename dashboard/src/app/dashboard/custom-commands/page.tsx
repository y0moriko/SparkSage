"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Terminal, Trash2, Command, HelpCircle } from "lucide-react";
import { api, type CustomCommand } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export default function CustomCommandsPage() {
  const { data: session } = useSession();
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (token) {
      fetchCommands();
    }
  }, [token]);

  async function fetchCommands() {
    try {
      const data = await api.getCustomCommands(token!);
      setCommands(data.commands);
    } catch (err) {
      toast.error("Failed to fetch custom commands");
    } finally {
      setLoading(false);
    }
  }

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [requiresInput, setRequiresInput] = useState(true);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    try {
      await api.addCustomCommand(token, {
        name: name.toLowerCase().replace(/\s+/g, "_"),
        description,
        prompt,
        requires_input: requiresInput,
      });
      toast.success("Command created! Note: You must restart the bot to see it.");
      setOpen(false);
      resetForm();
      fetchCommands();
    } catch (err) {
      toast.error("Failed to create command");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(name: string) {
    if (!token || !confirm(`Are you sure you want to delete /${name}?`)) return;

    try {
      await api.deleteCustomCommand(token, name);
      toast.success("Command deleted");
      fetchCommands();
    } catch (err) {
      toast.error("Failed to delete command");
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setPrompt("");
    setRequiresInput(true);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Custom AI Commands</h1>
          <p className="text-muted-foreground text-sm">Create specialized slash commands powered by specific AI instructions.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Add Command
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Add Custom Command</DialogTitle>
                <DialogDescription>
                  Create a new slash command for SparkSage.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Command Name</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-muted-foreground">/</span>
                    <Input 
                      id="name" 
                      placeholder="e.g. translate_pro" 
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      required 
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">No spaces, will be converted to lowercase_with_underscores.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input 
                    id="description" 
                    placeholder="Short description of what the command does..." 
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                    required 
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <Label>Require User Input</Label>
                    <p className="text-xs text-muted-foreground">If disabled, the command will execute immediately when typed.</p>
                  </div>
                  <Switch 
                    checked={requiresInput} 
                    onCheckedChange={setRequiresInput} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="prompt">AI Instructions (System Prompt)</Label>
                  <Textarea 
                    id="prompt" 
                    placeholder="e.g. You are a translation expert. Translate the user's input into formal Japanese..." 
                    value={prompt} 
                    onChange={e => setPrompt(e.target.value)}
                    className="h-32"
                    required 
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" />
                    This prompt is hidden from users. The AI will follow this when the command is used.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Command
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {commands.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Terminal className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="font-semibold text-lg">No custom commands yet</h3>
              <p className="text-muted-foreground max-w-xs mb-6 text-sm">
                Define specialized AI behavior through custom slash commands.
              </p>
              <Button variant="outline" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Command
              </Button>
            </CardContent>
          </Card>
        ) : (
          commands.map((cmd) => (
            <Card key={cmd.name}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Command className="h-4 w-4 text-primary" />
                      /{cmd.name}
                    </CardTitle>
                    <CardDescription>{cmd.description}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(cmd.name)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-muted rounded-md text-xs font-mono text-muted-foreground overflow-auto max-h-24">
                  {cmd.prompt}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
