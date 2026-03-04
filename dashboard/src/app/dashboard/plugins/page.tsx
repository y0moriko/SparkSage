"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Puzzle, RefreshCw, User, Info, CheckCircle2, XCircle, Plus } from "lucide-react";
import { api, type PluginItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function PluginsPage() {
  const { data: session } = useSession();
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (token) {
      fetchPlugins();
    }
  }, [token]);

  async function fetchPlugins() {
    setLoading(true);
    try {
      const data = await api.getPlugins(token!);
      setPlugins(data.plugins);
    } catch (err) {
      toast.error("Failed to fetch plugins");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    if (!token) return;
    setToggling(id);
    try {
      const res = await api.updatePluginStatus(token, id, enabled);
      toast.success(res.message);
      // Refresh list to pick up final state
      const data = await api.getPlugins(token!);
      setPlugins(data.plugins);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update plugin");
    } finally {
      setToggling(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (!file.name.endsWith(".zip")) {
      toast.error("Please upload a .zip file");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Installing plugin...");
    
    try {
      const res = await api.uploadPlugin(token, file);
      toast.success(res.message, { id: toastId });
      fetchPlugins(); // Refresh list
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading && plugins.length === 0) {
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
          <h1 className="text-2xl font-bold">Community Plugins</h1>
          <p className="text-muted-foreground text-sm">
            Extend SparkSage with community-contributed cogs and features.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".zip"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Install Plugin
          </Button>
          <Button variant="outline" size="sm" onClick={fetchPlugins} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {plugins.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Puzzle className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="font-semibold text-lg">No plugins discovered</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              Upload a plugin ZIP or drop your plugin folders into the <code>sparksage/plugins/</code> directory.
            </p>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              Install your first plugin
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <Card key={plugin.id} className={plugin.enabled ? "border-primary/20 bg-primary/5" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{plugin.name}</CardTitle>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">v{plugin.version}</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1.5 text-xs">
                      <User className="h-3.5 w-3.5" /> {plugin.author}
                    </CardDescription>
                  </div>
                  <div className="flex items-center">
                    {toggling === plugin.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch 
                        checked={plugin.enabled} 
                        onCheckedChange={(val) => handleToggle(plugin.id, val)}
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {plugin.description}
                </p>
              </CardContent>
              <CardFooter className="pt-0 flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                <div className="flex items-center gap-1">
                  <Puzzle className="h-3 w-3" /> {plugin.id}
                </div>
                <div className="flex items-center gap-1">
                  {plugin.enabled ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Inactive
                    </span>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-muted/50 border-none shadow-none">
        <CardContent className="pt-6 flex gap-4">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-3 text-sm">
            <p className="font-medium text-foreground text-base">New to Plugins?</p>
            <p className="text-muted-foreground leading-relaxed">
              SparkSage plugins are special "Add-ons" that give your bot new abilities. 
              Because SparkSage is built with Python, it only accepts plugins designed specifically for this bot.
            </p>
            <div className="grid gap-2 text-xs bg-background/50 p-3 rounded-md border border-border">
              <p className="font-semibold text-primary">Requirement Checklist:</p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                <li>Must be a <strong>.zip</strong> file containing a folder.</li>
                <li>Must contain a <strong>manifest.json</strong> file (the "ID card" of the plugin).</li>
                <li>Must contain a <strong>.py</strong> file (the Python code).</li>
                <li>JavaScript (.js) or other bot formats (like RedBot or MEE6) are not compatible.</li>
              </ul>
            </div>
            <p className="text-muted-foreground italic">
              Tip: If you found a plugin online in another language (like JavaScript), ask the bot developer or an AI to help you "port" it to a SparkSage Python Cog!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
