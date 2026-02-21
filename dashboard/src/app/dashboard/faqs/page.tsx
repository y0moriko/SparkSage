"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Trash2, Search, MessageSquare } from "lucide-react";
import { api, type FAQItem } from "@/lib/api";
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

export default function FAQsPage() {
  const { data: session } = useSession();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [guildId, setGuildId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [keywords, setKeywords] = useState("");

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (token) fetchFAQs();
  }, [token]);

  async function fetchFAQs() {
    try {
      const data = await api.getFAQs(token!);
      setFaqs(data.faqs);
    } catch (err) {
      toast.error("Failed to fetch FAQs");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    try {
      await api.createFAQ(token, {
        guild_id: guildId,
        question,
        answer,
        match_keywords: keywords,
      });
      toast.success("FAQ created successfully");
      setOpen(false);
      resetForm();
      fetchFAQs();
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
      fetchFAQs();
    } catch (err) {
      toast.error("Failed to delete FAQ");
    }
  }

  function resetForm() {
    setGuildId("");
    setQuestion("");
    setAnswer("");
    setKeywords("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FAQs</h1>
          <p className="text-muted-foreground text-sm">Manage automatic responses for frequently asked questions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add FAQ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Add FAQ Entry</DialogTitle>
                <DialogDescription>
                  The bot will automatically reply with the answer when it detects these keywords.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="guild">Guild ID</Label>
                  <Input 
                    id="guild" 
                    placeholder="Discord Server ID" 
                    value={guildId} 
                    onChange={e => setGuildId(e.target.value)}
                    required 
                  />
                </div>
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : faqs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No FAQs yet</h3>
            <p className="text-muted-foreground max-w-xs mb-6">
              Add your first FAQ entry to start automating responses in your Discord server.
            </p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add FAQ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {faqs.map((faq) => (
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
                   <span>Guild: {faq.guild_id}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
