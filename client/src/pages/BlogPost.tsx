import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";

import { Footer } from "@/components/Footer";
import { TrendingUp, ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function BlogPostPage() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug;

  const { data, isLoading, error } = useQuery<{ post: BlogPost }>({
    queryKey: ["/api/blog/posts", slug],
    enabled: !!slug,
  });

  const post = data?.post;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/" className="flex items-center gap-2" data-testid="link-home">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">OptionBuild</span>
            </Link>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/builder" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-builder">
              Builder
            </Link>
            <Link href="/blog" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-blog">
              Blog
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 md:px-6 py-8">
          <Link href="/blog" data-testid="link-back-to-blog">
            <Button variant="ghost" className="mb-6 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Button>
          </Link>

          {isLoading && (
            <div className="flex items-center justify-center py-24" data-testid="status-loading">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-center py-24" data-testid="status-error">
              <p className="text-lg text-muted-foreground">Post not found or an error occurred.</p>
              <Link href="/blog">
                <Button variant="outline" className="mt-4" data-testid="button-back-to-blog-error">
                  Back to Blog
                </Button>
              </Link>
            </div>
          )}

          {post && (
            <article className="max-w-3xl mx-auto" data-testid="article-blog-post">
              {post.coverImage && (
                <div className="relative w-full aspect-[2/1] rounded-md overflow-hidden mb-8">
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover"
                    data-testid="img-cover"
                  />
                </div>
              )}

              <h1 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-title">
                {post.title}
              </h1>

              {post.publishedAt && (
                <div className="flex items-center gap-2 text-muted-foreground mb-8" data-testid="text-date">
                  <Calendar className="h-4 w-4" />
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                </div>
              )}

              <div
                className="blog-content"
                dangerouslySetInnerHTML={{ __html: post.content }}
                data-testid="content-body"
              />
            </article>
          )}
        </div>
      </main>

      <Footer />

      <style>{`
        .blog-content {
          line-height: 1.8;
          color: hsl(var(--foreground));
        }
        .blog-content h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          line-height: 1.3;
        }
        .blog-content h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          line-height: 1.3;
        }
        .blog-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.75rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }
        .blog-content h4 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }
        .blog-content p {
          margin-bottom: 1.25rem;
        }
        .blog-content ul,
        .blog-content ol {
          margin-bottom: 1.25rem;
          padding-left: 1.5rem;
        }
        .blog-content ul {
          list-style-type: disc;
        }
        .blog-content ol {
          list-style-type: decimal;
        }
        .blog-content li {
          margin-bottom: 0.5rem;
        }
        .blog-content blockquote {
          border-left: 4px solid hsl(var(--primary));
          padding-left: 1rem;
          margin: 1.5rem 0;
          font-style: italic;
          color: hsl(var(--muted-foreground));
        }
        .blog-content pre {
          background: hsl(var(--muted));
          border-radius: 0.375rem;
          padding: 1rem;
          overflow-x: auto;
          margin-bottom: 1.25rem;
          font-size: 0.875rem;
        }
        .blog-content code {
          background: hsl(var(--muted));
          padding: 0.15rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        .blog-content pre code {
          background: none;
          padding: 0;
          border-radius: 0;
        }
        .blog-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.375rem;
          margin: 1.5rem 0;
        }
        .blog-content a {
          color: hsl(var(--primary));
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .blog-content a:hover {
          opacity: 0.8;
        }
        .blog-content hr {
          border: none;
          border-top: 1px solid hsl(var(--border));
          margin: 2rem 0;
        }
        .blog-content table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.25rem;
        }
        .blog-content th,
        .blog-content td {
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .blog-content th {
          background: hsl(var(--muted));
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
