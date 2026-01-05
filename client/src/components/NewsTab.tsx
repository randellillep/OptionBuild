import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Clock, User, Newspaper } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface NewsArticle {
  id: number;
  headline: string;
  summary: string;
  author: string;
  source: string;
  url: string;
  symbols: string[];
  createdAt: string;
  updatedAt: string;
}

interface NewsTabProps {
  symbol: string;
}

export function NewsTab({ symbol }: NewsTabProps) {
  const { data, isLoading, error } = useQuery<{ articles: NewsArticle[]; count: number }>({
    queryKey: ['/api/news', symbol],
    enabled: !!symbol,
  });

  if (!symbol) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Newspaper className="h-12 w-12 mb-4 opacity-50" />
        <p>Enter a symbol to see related news</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-2/3 mb-3" />
            <div className="flex gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Newspaper className="h-12 w-12 mb-4 opacity-50" />
        <p>Unable to load news for {symbol}</p>
        <p className="text-sm mt-1">Please try again later</p>
      </div>
    );
  }

  const articles = data?.articles || [];

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Newspaper className="h-12 w-12 mb-4 opacity-50" />
        <p>No recent news for {symbol}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          Latest News for {symbol}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {articles.length} articles
        </Badge>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {articles.map((article) => (
          <Card 
            key={article.id} 
            className="p-4 hover-elevate cursor-pointer transition-all"
            data-testid={`news-article-${article.id}`}
          >
            <a 
              href={article.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-medium text-sm leading-tight line-clamp-2 flex-1">
                  {article.headline}
                </h4>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              </div>
              
              {article.summary && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {article.summary}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}</span>
                </div>
                
                {article.source && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {article.source}
                  </Badge>
                )}
                
                {article.author && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">{article.author}</span>
                  </div>
                )}
              </div>

              {article.symbols && article.symbols.length > 1 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {article.symbols.slice(0, 5).map((sym) => (
                    <Badge 
                      key={sym} 
                      variant={sym === symbol ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {sym}
                    </Badge>
                  ))}
                  {article.symbols.length > 5 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      +{article.symbols.length - 5}
                    </Badge>
                  )}
                </div>
              )}
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
