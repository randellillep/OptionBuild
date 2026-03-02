import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Calendar, ArrowRight, BookOpen, Settings } from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  published: number;
  publishedAt: string | null;
  createdAt: string;
}

export default function Blog() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error } = useQuery<{ posts: BlogPost[] }>({
    queryKey: ["/api/blog/posts"],
  });
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const isAdmin = adminCheck?.isAdmin ?? false;
  const posts = data?.posts ?? [];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">OptionBuild</span>
          </Link>

          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/builder" data-testid="link-builder">
              <Button variant="ghost" className="text-sm font-medium">
                Builder
              </Button>
            </Link>
            {isAdmin && (
              <Link href="/admin/blog" data-testid="link-admin-blog">
                <Button variant="ghost" className="text-sm font-medium">
                  <Settings className="h-4 w-4 mr-1" />
                  Manage Posts
                </Button>
              </Link>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-blog-title">
                Blog
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Insights, guides, and updates on options trading strategies
              </p>
            </div>

            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-visible">
                    <Skeleton className="h-48 w-full rounded-t-md" />
                    <div className="p-5 space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {error && (
              <div className="text-center py-16" data-testid="text-blog-error">
                <p className="text-muted-foreground">Failed to load blog posts. Please try again later.</p>
              </div>
            )}

            {!isLoading && !error && posts.length === 0 && (
              <div className="text-center py-16" data-testid="text-blog-empty">
                <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No posts yet</h3>
                <p className="text-muted-foreground">
                  Check back soon for articles on options trading strategies and market insights.
                </p>
              </div>
            )}

            {!isLoading && !error && posts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-blog-posts">
                {posts.map((post) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} data-testid={`link-post-${post.id}`}>
                    <Card className="overflow-visible h-full flex flex-col hover-elevate cursor-pointer">
                      {post.coverImage && (
                        <div className="relative w-full aspect-video overflow-hidden rounded-t-md">
                          <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-full h-full object-cover"
                            data-testid={`img-cover-${post.id}`}
                          />
                        </div>
                      )}
                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Calendar className="h-3 w-3" />
                          <span data-testid={`text-date-${post.id}`}>
                            {formatDate(post.publishedAt || post.createdAt)}
                          </span>
                        </div>
                        <h2 className="text-lg font-semibold mb-2 line-clamp-2" data-testid={`text-title-${post.id}`}>
                          {post.title}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1" data-testid={`text-excerpt-${post.id}`}>
                          {post.excerpt}
                        </p>
                        <div className="flex items-center gap-1 text-sm text-primary font-medium">
                          Read more
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
