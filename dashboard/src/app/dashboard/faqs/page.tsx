"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Trash2, Search, MessageSquare, RefreshCw } from "lucide-react";
import { api, type FAQItem, type BotStatus } from "@/lib/api";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function FAQsPage() {
  const { data: session } = useSession();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedGuildId, setSelectedGuildId] = useState<string>("");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  async function fetchData() {
    try {
      const [faqsData, status] = await Promise.all([
        api.getFAQs(token!),
        api.getBotStatus(token!),
      ]);
      setFaqs(faqsData.faqs);
      setBotStatus(status);
      if (status.guilds.length > 0 && !selectedGuildId) {
        setSelectedGuildId(status.guilds[0].id);
      }
    } catch (err) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  // Form state
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [keywords, setKeywords] = useState("");

  const filteredFaqs = selectedGuildId 
    ? faqs.filter(f => f.guild_id === selectedGuildId)
    : faqs;

  const currentGuildName = botStatus?.guilds.find(g => g.id === selectedGuildId)?.name || selectedGuildId;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedGuildId) return;

    setSubmitting(true);
    try {
      await api.createFAQ(token, {
        guild_id: selectedGuildId,
        question,
        answer,
        match_keywords: keywords,
      });
      toast.success("FAQ created successfully");
      setOpen(false);
      resetForm();
      const data = await api.getFAQs(token!);
      setFaqs(data.faqs);
    } catch (err) {
      toast.error("Failed to create FAQ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm("Are you sure you want to delete this FAQ?")) return;

    try {
      await api.deleteFAQ(token, id);
      toast.success("FAQ deleted");
      const data = await api.getFAQs(token!);
      setFaqs(data.faqs);
    } catch (err) {
      toast.error("Failed to delete FAQ");
    }
  }

  function resetForm() {
    setQuestion("");
    setAnswer("");
    setKeywords("");
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
          <h1 className="text-2xl font-bold">FAQs</h1>
          <p className="text-muted-foreground text-sm">Manage automatic responses for {currentGuildName}.</p>
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
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" /> Add FAQ
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Add FAQ Entry</DialogTitle>
                  <DialogDescription>
                    Adding FAQ for <strong>{currentGuildName}</strong>.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="question">Question</Label>
                    <Input 
                      id="question" 
                      placeholder="e.g. How do I join?" 
                      value={question} 
                      onChange={e => setQuestion(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="answer">Answer</Label>
                    <Textarea 
                      id="answer" 
                      placeholder="The response the bot will send..." 
                      value={answer} 
                      onChange={e => setAnswer(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="keywords">Keywords</Label>
                    <Input 
                      id="keywords" 
                      placeholder="join, how to join, invite (comma separated)" 
                      value={keywords} 
                      onChange={e => setKeywords(e.target.value)}
                      required 
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create FAQ
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filteredFaqs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No FAQs for this server</h3>
            <p className="text-muted-foreground max-w-xs mb-6">
              Add your first FAQ entry to start automating responses in {currentGuildName}.
            </p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add FAQ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredFaqs.map((faq) => (
            <Card key={faq.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{faq.question}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Search className="h-3 w-3" />
                      Keywords: {faq.match_keywords.split(',').map(k => (
                        <Badge key={k} variant="secondary" className="text-[10px] px-1 py-0">{k.trim()}</Badge>
                      ))}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(faq.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="text-muted-foreground line-clamp-2">{faq.answer}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                   <span>Used {faq.times_used} times</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
