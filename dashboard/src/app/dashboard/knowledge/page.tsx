"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, FileUp, FileText, Trash2, BookOpen } from "lucide-react";
import { api, type KnowledgeFile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function KnowledgePage() {
  const { data: session } = useSession();
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const token = (session as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (token) {
      fetchFiles();
    }
  }, [token]);

  async function fetchFiles() {
    try {
      const data = await api.getKnowledgeFiles(token!);
      setFiles(data.files);
    } catch (err) {
      toast.error("Failed to fetch knowledge base files");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (!file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      toast.error("Only .txt and .md files are supported currently.");
      return;
    }

    setUploading(true);
    try {
      await api.uploadKnowledgeFile(token, file);
      toast.success(`${file.name} uploaded successfully!`);
      fetchFiles();
    } catch (err) {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(filename: string) {
    if (!token || !confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      await api.deleteKnowledgeFile(token, filename);
      toast.success("File deleted");
      fetchFiles();
    } catch (err) {
      toast.error("Failed to delete file");
    }
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground text-sm">Upload documents to give SparkSage specialized knowledge.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="default" disabled={uploading} asChild>
            <label className="cursor-pointer">
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Upload .txt/.md
              <input type="file" className="hidden" accept=".txt,.md" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Files in this folder are automatically included in the bot's system prompt to provide context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="font-semibold text-lg">No documents yet</h3>
              <p className="text-muted-foreground max-w-xs mb-6 text-sm">
                Upload text or markdown files to build your bot's custom knowledge.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {files.map((file) => (
                <div key={file.name} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(file.size)} • {file.type.toUpperCase()}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(file.name)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
