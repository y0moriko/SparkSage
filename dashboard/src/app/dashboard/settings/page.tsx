"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save, RotateCcw } from "lucide-react";
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
  WELCOME_ENABLED: z.boolean(),
  WELCOME_CHANNEL_ID: z.string(),
  WELCOME_MESSAGE: z.string(),
  DIGEST_ENABLED: z.boolean(),
  DIGEST_CHANNEL_ID: z.string(),
  DIGEST_TIME: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  MODERATION_ENABLED: z.boolean(),
  MOD_LOG_CHANNEL_ID: z.string(),
  MODERATION_SENSITIVITY: z.enum(["low", "medium", "high"]),
  GEMINI_API_KEY: z.string(),
  GROQ_API_KEY: z.string(),
  OPENROUTER_API_KEY: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const DEFAULTS: SettingsForm = {
  DISCORD_TOKEN: "",
  BOT_PREFIX: "!",
  MAX_TOKENS: 1024,
  SYSTEM_PROMPT:
    "You are SparkSage, a helpful and friendly AI assistant in a Discord server. Be concise, helpful, and engaging.",
  WELCOME_ENABLED: false,
  WELCOME_CHANNEL_ID: "",
  WELCOME_MESSAGE: "Welcome {user} to {server}! I am SparkSage, your AI assistant. Feel free to ask me anything about the server or our community.",
  DIGEST_ENABLED: false,
  DIGEST_CHANNEL_ID: "",
  DIGEST_TIME: "09:00",
  MODERATION_ENABLED: false,
  MOD_LOG_CHANNEL_ID: "",
  MODERATION_SENSITIVITY: "medium",
  GEMINI_API_KEY: "",
  GROQ_API_KEY: "",
  OPENROUTER_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  OPENAI_API_KEY: "",
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
            if (key === "MAX_TOKENS") {
              mapped[key] = Number(config[key]);
            } else if (key === "WELCOME_ENABLED" || key === "DIGEST_ENABLED" || key === "MODERATION_ENABLED") {
              mapped[key] = String(config[key]).toLowerCase() === "true";
            } else {
              (mapped as any)[key] = config[key];
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
        if (!strVal.startsWith("***")) {
          payload[key] = strVal;
        }
      }
      await api.updateConfig(token, payload);
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    form.reset(DEFAULTS);
  }

  const maxTokens = form.watch("MAX_TOKENS");
  const systemPrompt = form.watch("SYSTEM_PROMPT");
  const welcomeEnabled = form.watch("WELCOME_ENABLED");
  const digestEnabled = form.watch("DIGEST_ENABLED");
  const moderationEnabled = form.watch("MODERATION_ENABLED");
  const moderationSensitivity = form.watch("MODERATION_SENSITIVITY");

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
            <CardTitle className="text-base">Discord</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="discord-token">Bot Token</Label>
              <Input id="discord-token" type="password" {...form.register("DISCORD_TOKEN")} />
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

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[["GEMINI_API_KEY", "Gemini"], ["GROQ_API_KEY", "Groq"], ["OPENROUTER_API_KEY", "OpenRouter"], ["ANTHROPIC_API_KEY", "Anthropic"], ["OPENAI_API_KEY", "OpenAI"]].map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key}>{label}</Label>
                <Input id={key} type="password" {...form.register(key as any)} className="font-mono text-sm" />
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
