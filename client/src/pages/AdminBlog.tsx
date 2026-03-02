import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  Image,
  Loader2,
  ShieldAlert,
} from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  published: number;
  publishedAt: string | null;
  createdAt: string;
}

function autoSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminBlog() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const {
    data: adminCheck,
    isLoading: adminLoading,
  } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
    retry: false,
  });

  const [view, setView] = useState<"list" | "editor">("list");
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [published, setPublished] = useState(false);

  const { data: postsData, isLoading: postsLoading } = useQuery<{
    posts: BlogPost[];
  }>({
    queryKey: ["/api/admin/blog/posts"],
    enabled: adminCheck?.isAdmin === true,
  });

  const posts = postsData?.posts ?? [];

  useEffect(() => {
    if (!editingPost) return;
    setTitle(editingPost.title);
    setSlug(editingPost.slug);
    setExcerpt(editingPost.excerpt);
    setContent(editingPost.content || "");
    setCoverImage(editingPost.coverImage || "");
    setPublished(editingPost.published === 1);
  }, [editingPost]);

  function resetForm() {
    setTitle("");
    setSlug("");
    setExcerpt("");
    setContent("");
    setCoverImage("");
    setPublished(false);
    setEditingPost(null);
    setShowPreview(false);
  }

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!editingPost) {
      setSlug(autoSlug(val));
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title,
        slug,
        excerpt,
        content,
        coverImage: coverImage || null,
        published: published ? 1 : 0,
      };
      if (editingPost) {
        await apiRequest("PUT", `/api/admin/blog/posts/${editingPost.id}`, body);
      } else {
        await apiRequest("POST", "/api/admin/blog/posts", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/posts"] });
      toast({ title: editingPost ? "Post updated" : "Post created" });
      resetForm();
      setView("list");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/blog/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/posts"] });
      toast({ title: "Post deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiRequest("POST", "/api/admin/blog/upload", {
        filename: file.name,
        mimeType: file.type,
        data: base64,
      });
      return res.json() as Promise<{ id: string; url: string }>;
    },
    onSuccess: (data) => {
      setCoverImage(data.url);
      toast({ title: "Image uploaded", description: `URL: ${data.url}` });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  }

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || !adminCheck?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2" data-testid="text-access-denied">
            Access Denied
          </h1>
          <p className="text-muted-foreground" data-testid="text-access-denied-message">
            You do not have permission to access this page.
          </p>
        </Card>
      </div>
    );
  }

  if (view === "editor") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 md:px-6 py-8 max-w-4xl">
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <Button
              variant="ghost"
              onClick={() => {
                resetForm();
                setView("list");
              }}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold" data-testid="text-editor-title">
              {editingPost ? "Edit Post" : "New Post"}
            </h1>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Post title"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="post-slug"
                data-testid="input-slug"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Brief description of the post..."
                rows={3}
                data-testid="input-excerpt"
              />
            </div>

            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                    data-testid="input-cover-image-file"
                  />
                  <Button
                    variant="outline"
                    asChild
                    disabled={uploadMutation.isPending}
                  >
                    <span>
                      {uploadMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload Image
                    </span>
                  </Button>
                </label>
                <Input
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="Or paste image URL"
                  className="flex-1 min-w-[200px]"
                  data-testid="input-cover-image-url"
                />
              </div>
              {coverImage && (
                <div className="mt-2 flex items-center gap-2">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground break-all">
                    {coverImage}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label htmlFor="content">Content (HTML)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  data-testid="button-toggle-preview"
                >
                  {showPreview ? (
                    <EyeOff className="h-4 w-4 mr-2" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  {showPreview ? "Hide Preview" : "Preview"}
                </Button>
              </div>
              {showPreview ? (
                <Card className="p-6">
                  <div
                    className="blog-content prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: content }}
                    data-testid="content-preview"
                  />
                </Card>
              ) : (
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="<h2>Your post content...</h2><p>Write HTML here</p>"
                  rows={16}
                  className="font-mono text-sm"
                  data-testid="input-content"
                />
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="published"
                checked={published}
                onCheckedChange={setPublished}
                data-testid="switch-published"
              />
              <Label htmlFor="published">Published</Label>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !title || !slug}
                data-testid="button-save-post"
              >
                {saveMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingPost ? "Update Post" : "Create Post"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setView("list");
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 md:px-6 py-8 max-w-4xl">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <h1 className="text-2xl font-bold" data-testid="text-admin-blog-title">
            Blog Management
          </h1>
          <Button
            onClick={() => {
              resetForm();
              setView("editor");
            }}
            data-testid="button-new-post"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Button>
        </div>

        {postsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground" data-testid="text-no-posts">
              No blog posts yet. Create your first post!
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card
                key={post.id}
                className="p-4 flex items-center justify-between gap-4 flex-wrap"
                data-testid={`card-post-${post.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate" data-testid={`text-post-title-${post.id}`}>
                      {post.title}
                    </h3>
                    <Badge
                      variant={post.published ? "default" : "secondary"}
                      data-testid={`badge-status-${post.id}`}
                    >
                      {post.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingPost(post);
                      setView("editor");
                    }}
                    data-testid={`button-edit-${post.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("Delete this post?")) {
                        deleteMutation.mutate(post.id);
                      }
                    }}
                    data-testid={`button-delete-${post.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
