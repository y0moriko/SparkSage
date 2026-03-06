"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save, RotateCcw, Edit2, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

const settingsSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "Discord token is required"),
  BOT_PREFIX: z.string().min(1).max(5),
  MAX_TOKENS: z.number().min(128).max(4096),
  SYSTEM_PROMPT: z.string().min(1),
  RATE_LIMIT_USER: z.number().min(1).max(60),
  RATE_LIMIT_GUILD: z.number().min(1).max(200),
  WELCOME_ENABLED: z.boolean(),
  WELCOME_CHANNEL_ID: z.string(),
  WELCOME_MESSAGE: z.string(),
  DIGEST_ENABLED: z.boolean(),
  DIGEST_CHANNEL_ID: z.string(),
  DIGEST_TIME: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  MODERATION_ENABLED: z.boolean(),
  MOD_LOG_CHANNEL_ID: z.string(),
  MODERATION_SENSITIVITY: z.enum(["low", "medium", "high"]),
  TRANSLATION_ENABLED: z.boolean(),
  TRANSLATION_TARGET_LANG: z.string(),
  TRANSLATION_CHANNEL_IDS: z.string(),
  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string(),
  GROQ_API_KEY: z.string(),
  GROQ_MODEL: z.string(),
  OPENROUTER_API_KEY: z.string(),
  OPENROUTER_MODEL: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  ANTHROPIC_MODEL: z.string(),
  OPENAI_API_KEY: z.string(),
  OPENAI_MODEL: z.string(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const DEFAULTS: SettingsForm = {
  DISCORD_TOKEN: "",
  BOT_PREFIX: "!",
  MAX_TOKENS: 1024,
  SYSTEM_PROMPT:
    "You are SparkSage, a helpful and friendly AI assistant in a Discord server. Be concise, helpful, and engaging.",
  RATE_LIMIT_USER: 5,
  RATE_LIMIT_GUILD: 20,
  WELCOME_ENABLED: false,
  WELCOME_CHANNEL_ID: "",
  WELCOME_MESSAGE: "Welcome {user} to {server}! I am SparkSage, your AI assistant. Feel free to ask me anything about the server or our community.",
  DIGEST_ENABLED: false,
  DIGEST_CHANNEL_ID: "",
  DIGEST_TIME: "09:00",
  MODERATION_ENABLED: false,
  MOD_LOG_CHANNEL_ID: "",
  MODERATION_SENSITIVITY: "medium",
  TRANSLATION_ENABLED: false,
  TRANSLATION_TARGET_LANG: "English",
  TRANSLATION_CHANNEL_IDS: "",
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "gemini-2.5-flash",
  GROQ_API_KEY: "",
  GROQ_MODEL: "llama-3.3-70b-versatile",
  OPENROUTER_API_KEY: "",
  OPENROUTER_MODEL: "openrouter/free",
  ANTHROPIC_API_KEY: "",
  ANTHROPIC_MODEL: "claude-3-5-sonnet-20241022",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "gpt-4o-mini",
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKeys, setEditingKeys] = useState<Record<string, boolean>>({});

  const token = (session as { accessToken?: string })?.accessToken;

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!token) return;
    api
      .getConfig(token)
      .then(({ config }) => {
        const mapped: Partial<SettingsForm> = {};
        for (const key of Object.keys(DEFAULTS) as (keyof SettingsForm)[]) {
          if (config[key] !== undefined) {
            // If the value is "NOT_SET", we treat it as empty for the form
            const val = config[key] === "NOT_SET" ? "" : config[key];
            
            if (key === "MAX_TOKENS" || key === "RATE_LIMIT_USER" || key === "RATE_LIMIT_GUILD") {
              mapped[key] = Number(val);
            } else if (
              key === "WELCOME_ENABLED" || 
              key === "DIGEST_ENABLED" || 
              key === "MODERATION_ENABLED" ||
              key === "TRANSLATION_ENABLED"
            ) {
              mapped[key] = String(val).toLowerCase() === "true";
            } else {
              (mapped as any)[key] = val;
            }
          }
        }
        form.reset({ ...DEFAULTS, ...mapped });
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [token, form]);

  async function onSubmit(values: SettingsForm) {
    if (!token) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const [key, val] of Object.entries(values)) {
        const strVal = String(val);
        // Only include if it's not a masked value AND not the NOT_SET sentinel
        // OR if the user explicitly enabled editing for it (meaning they typed a new value)
        if (editingKeys[key]) {
           payload[key] = strVal;
        } else if (!strVal.startsWith("***") && strVal !== "NOT_SET" && strVal !== "") {
           payload[key] = strVal;
        }
      }
      
      if (Object.keys(payload).length === 0) {
        toast.info("No changes to save");
        setSaving(false);
        return;
      }

      // The API helper already wraps this in a 'values' key
      await api.updateConfig(token, payload);
      toast.success("Settings saved successfully");
      setEditingKeys({}); // Clear editing state
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    form.reset(DEFAULTS);
  }

  const toggleEdit = (key: string) => {
    setEditingKeys(prev => ({ ...prev, [key]: !prev[key] }));
    if (!editingKeys[key]) {
      // Clear the masked value when entering edit mode so they can type a fresh one
      form.setValue(key as any, "");
    }
  };

  const maxTokens = form.watch("MAX_TOKENS");
  const rateLimitUser = form.watch("RATE_LIMIT_USER");
  const rateLimitGuild = form.watch("RATE_LIMIT_GUILD");
  const welcomeEnabled = form.watch("WELCOME_ENABLED");
  const digestEnabled = form.watch("DIGEST_ENABLED");
  const moderationEnabled = form.watch("MODERATION_ENABLED");
  const moderationSensitivity = form.watch("MODERATION_SENSITIVITY");
  const translationEnabled = form.watch("TRANSLATION_ENABLED");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1 h-3 w-3" /> Reset to Defaults
          </Button>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-12">
        {/* Discord */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Discord
              <Button type="button" variant="ghost" size="sm" onClick={() => toggleEdit("DISCORD_TOKEN")} className="h-8 w-8 p-0">
                {editingKeys["DISCORD_TOKEN"] ? <X className="h-4 w-4 text-destructive" /> : <Edit2 className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="discord-token">Bot Token</Label>
              <Input 
                id="discord-token" 
                type="password" 
                {...form.register("DISCORD_TOKEN")} 
                disabled={!editingKeys["DISCORD_TOKEN"]}
                placeholder={editingKeys["DISCORD_TOKEN"] ? "Paste new token here..." : "Protected (Click edit to change)"}
              />
              {form.formState.errors.DISCORD_TOKEN && (
                <p className="text-xs text-destructive">{form.formState.errors.DISCORD_TOKEN.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Member Onboarding</CardTitle>
            <CardDescription>Configure how the bot greets new members.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Enable Welcome Message</Label>
              <RadioGroup 
                value={welcomeEnabled ? "true" : "false"} 
                onValueChange={(val) => form.setValue("WELCOME_ENABLED", val === "true")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="welcome-on" />
                  <Label htmlFor="welcome-on" className="font-normal">On</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="welcome-off" />
                  <Label htmlFor="welcome-off" className="font-normal">Off</Label>
                </div>
              </RadioGroup>
            </div>

            {welcomeEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="welcome-channel">Welcome Channel ID</Label>
                  <Input id="welcome-channel" placeholder="e.g. 1234567890..." {...form.register("WELCOME_CHANNEL_ID")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcome-message">Welcome Message Template</Label>
                  <Textarea id="welcome-message" {...form.register("WELCOME_MESSAGE")} rows={3} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Daily Digest Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Digest</CardTitle>
            <CardDescription>Automatically summarize and post daily server activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Enable Daily Digest</Label>
              <RadioGroup 
                value={digestEnabled ? "true" : "false"} 
                onValueChange={(val) => form.setValue("DIGEST_ENABLED", val === "true")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="digest-on" />
                  <Label htmlFor="digest-on" className="font-normal">On</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="digest-off" />
                  <Label htmlFor="digest-off" className="font-normal">Off</Label>
                </div>
              </RadioGroup>
            </div>

            {digestEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="digest-channel">Digest Channel ID</Label>
                  <Input id="digest-channel" placeholder="e.g. 1234567890..." {...form.register("DIGEST_CHANNEL_ID")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="digest-time">Digest Time (24h format)</Label>
                  <Input id="digest-time" placeholder="09:00" {...form.register("DIGEST_TIME")} className="w-32" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* AI Moderation Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Moderation</CardTitle>
            <CardDescription>Flag potentially toxic or rule-breaking content for review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Enable AI Moderation</Label>
              <RadioGroup 
                value={moderationEnabled ? "true" : "false"} 
                onValueChange={(val) => form.setValue("MODERATION_ENABLED", val === "true")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="mod-on" />
                  <Label htmlFor="mod-on" className="font-normal">On</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="mod-off" />
                  <Label htmlFor="mod-off" className="font-normal">Off</Label>
                </div>
              </RadioGroup>
            </div>

            {moderationEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mod-channel">Mod Log Channel ID</Label>
                  <Input id="mod-channel" placeholder="e.g. 1234567890..." {...form.register("MOD_LOG_CHANNEL_ID")} />
                </div>
                <div className="space-y-3">
                  <Label>Sensitivity</Label>
                  <RadioGroup 
                    value={moderationSensitivity} 
                    onValueChange={(val) => form.setValue("MODERATION_SENSITIVITY", val as any)}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="low" id="sens-low" />
                      <Label htmlFor="sens-low" className="font-normal">Low</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="medium" id="sens-med" />
                      <Label htmlFor="sens-med" className="font-normal">Medium</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="high" id="sens-high" />
                      <Label htmlFor="sens-high" className="font-normal">High</Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Translation Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-Translation</CardTitle>
            <CardDescription>Automatically detect and translate messages not in the target language.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Enable Auto-Translation</Label>
              <RadioGroup 
                value={translationEnabled ? "true" : "false"} 
                onValueChange={(val) => form.setValue("TRANSLATION_ENABLED", val === "true")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="trans-on" />
                  <Label htmlFor="trans-on" className="font-normal">On</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="trans-off" />
                  <Label htmlFor="trans-off" className="font-normal">Off</Label>
                </div>
              </RadioGroup>
            </div>

            {translationEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="trans-lang">Target Language</Label>
                  <Input id="trans-lang" placeholder="English" {...form.register("TRANSLATION_TARGET_LANG")} />
                  <p className="text-[10px] text-muted-foreground">Messages will be translated into this language.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trans-channels">Designated Channel IDs</Label>
                  <Input id="trans-channels" placeholder="e.g. 1234, 5678 or *" {...form.register("TRANSLATION_CHANNEL_IDS")} />
                  <p className="text-[10px] text-muted-foreground">Only messages in these channels will be auto-translated. Use <code>*</code> for all channels.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bot Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bot Behavior</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="prefix">Command Prefix</Label>
              <Input id="prefix" {...form.register("BOT_PREFIX")} className="w-24" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Max Tokens</Label>
                <span className="text-sm font-mono text-muted-foreground">{maxTokens}</span>
              </div>
              <Slider value={[maxTokens]} onValueChange={([val]) => form.setValue("MAX_TOKENS", val)} min={128} max={4096} step={64} />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="system-prompt">System Prompt</Label>
              <Textarea id="system-prompt" {...form.register("SYSTEM_PROMPT")} rows={4} />
            </div>
          </CardContent>
        </Card>

        {/* Rate Limiting */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rate Limiting</CardTitle>
            <CardDescription>Prevent abuse by limiting AI requests per minute.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>User Limit (Req/Min)</Label>
                <span className="text-sm font-mono text-muted-foreground">{rateLimitUser}</span>
              </div>
              <Slider 
                value={[rateLimitUser]} 
                onValueChange={([val]) => form.setValue("RATE_LIMIT_USER", val)} 
                min={1} 
                max={60} 
                step={1} 
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Server Limit (Req/Min)</Label>
                <span className="text-sm font-mono text-muted-foreground">{rateLimitGuild}</span>
              </div>
              <Slider 
                value={[rateLimitGuild]} 
                onValueChange={([val]) => form.setValue("RATE_LIMIT_GUILD", val)} 
                min={1} 
                max={200} 
                step={5} 
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Provider Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Providers</CardTitle>
            <CardDescription>Configure API keys and preferred models for each provider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {[
              { key: "GEMINI", label: "Google Gemini" },
              { key: "GROQ", label: "Groq" },
              { key: "OPENROUTER", label: "OpenRouter" },
              { key: "ANTHROPIC", label: "Anthropic Claude" },
              { key: "OPENAI", label: "OpenAI" }
            ].map(({ key, label }) => (
              <div key={key} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{label}</h4>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${key}_API_KEY`} className="text-xs">API Key</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => toggleEdit(`${key}_API_KEY`)} className="h-5 w-5 p-0">
                        {editingKeys[`${key}_API_KEY`] ? <X className="h-3 w-3 text-destructive" /> : <Edit2 className="h-3 w-3" />}
                      </Button>
                    </div>
                    <Input 
                      id={`${key}_API_KEY`} 
                      type="password" 
                      {...form.register(`${key}_API_KEY` as any)} 
                      className="font-mono text-xs" 
                      disabled={!editingKeys[`${key}_API_KEY`]}
                      placeholder={editingKeys[`${key}_API_KEY`] ? "Paste new key..." : "Protected (Click edit to change)"}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${key}_MODEL`} className="text-xs">Model ID</Label>
                    <Input 
                      id={`${key}_MODEL`} 
                      {...form.register(`${key}_MODEL` as any)} 
                      className="font-mono text-xs" 
                      placeholder="e.g. gpt-4o-mini"
                    />
                  </div>
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </form>
    </div>
  );
}
