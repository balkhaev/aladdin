/**
 * AI Analyzed Content Feed
 * Displays feed of all content analyzed by GPT
 */

import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  ExternalLink,
  MessageSquare,
  Newspaper,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Twitter,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSocialFeedWebSocket } from "@/hooks/use-social-feed-ws";

type AnalyzedContent = {
  id: string;
  contentType: "tweet" | "reddit_post" | "telegram_message" | "news";
  source: string;
  title: string | null;
  text: string;
  url: string | null;
  author: string | null;
  symbols: string[];
  publishedAt: string;
  engagement: number;
  sentiment: {
    score: number;
    confidence: number;
  };
  method: string;
  marketImpact: string | null;
  summary: string | null;
  keyPoints: string[];
  analyzedAt: string;
};

async function fetchAnalyzedFeed(params: {
  limit?: number;
  offset?: number;
  contentType?: string;
}): Promise<AnalyzedContent[]> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());
  if (params.contentType) searchParams.set("contentType", params.contentType);

  const response = await fetch(`/api/social/feed?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch analyzed feed");
  }

  const data = await response.json();
  return data.data.items;
}

function ContentIcon({ type }: { type: string }) {
  switch (type) {
    case "tweet":
      return <Twitter className="h-4 w-4 text-blue-500" />;
    case "reddit_post":
      return <MessageSquare className="h-4 w-4 text-orange-500" />;
    case "telegram_message":
      return <MessageSquare className="h-4 w-4 text-blue-400" />;
    case "news":
      return <Newspaper className="h-4 w-4 text-purple-500" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
}

function getConfidenceBadgeVariant(
  confidence: number
): "default" | "secondary" | "outline" {
  if (confidence > 0.7) {
    return "default";
  }
  if (confidence > 0.4) {
    return "secondary";
  }
  return "outline";
}

function SentimentBadge({ score }: { score: number }) {
  const percentage = Math.abs(score * 100).toFixed(0);

  if (score > 0.3) {
    return (
      <Badge className="gap-1" variant="default">
        <TrendingUp className="h-3 w-3" />
        Bullish {percentage}%
      </Badge>
    );
  }

  if (score < -0.3) {
    return (
      <Badge className="gap-1" variant="destructive">
        <TrendingDown className="h-3 w-3" />
        Bearish {percentage}%
      </Badge>
    );
  }

  return (
    <Badge className="gap-1" variant="secondary">
      Neutral
    </Badge>
  );
}

function FeedItem({ item }: { item: AnalyzedContent }) {
  const isGPT = item.method === "gpt";
  const date = new Date(item.publishedAt);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <ContentIcon type={item.contentType} />
            <div className="space-y-1">
              {item.title && (
                <h3 className="font-semibold text-sm leading-none">
                  {item.title}
                </h3>
              )}
              {item.author && (
                <p className="text-muted-foreground text-xs">
                  {item.author} · {item.source}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isGPT && (
              <Badge className="gap-1" variant="outline">
                <Bot className="h-3 w-3" />
                GPT
              </Badge>
            )}
            <SentimentBadge score={item.sentiment.score} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary for news or text for other content */}
        {item.summary ? (
          <p className="text-sm leading-relaxed">{item.summary}</p>
        ) : (
          <p className="text-sm leading-relaxed">
            {item.text.length > 280
              ? `${item.text.slice(0, 280)}...`
              : item.text}
          </p>
        )}

        {/* Key points for news */}
        {item.keyPoints && item.keyPoints.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-xs">Key Points:</p>
            <ul className="space-y-1">
              {item.keyPoints.slice(0, 3).map((point, i) => (
                <li className="flex items-start gap-2 text-xs" key={i}>
                  <span className="text-muted-foreground">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Symbols */}
        {item.symbols.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.symbols.slice(0, 5).map((symbol) => (
              <Badge className="text-xs" key={symbol} variant="secondary">
                {symbol}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 text-muted-foreground text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {item.engagement}
            </div>
            <span>
              {date.toLocaleDateString()} {date.toLocaleTimeString()}
            </span>
            <Badge
              className="text-xs"
              variant={getConfidenceBadgeVariant(item.sentiment.confidence)}
            >
              {(item.sentiment.confidence * 100).toFixed(0)}% confident
            </Badge>
          </div>
          {item.url && (
            <Button asChild size="sm" variant="ghost">
              <a href={item.url} rel="noopener noreferrer" target="_blank">
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FeedSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <Skeleton className="h-4 w-4" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <div className="flex gap-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function AIAnalyzedFeed() {
  // WebSocket real-time updates
  const { isConnected: wsConnected } = useSocialFeedWebSocket(undefined, true);

  // Initial data fetch (WebSocket keeps it fresh)
  const { data: allItems, isLoading: isLoadingAll } = useQuery({
    queryKey: ["social-feed", {}],
    queryFn: () => fetchAnalyzedFeed({ limit: 50 }),
    // WebSocket keeps cache fresh - no polling needed
    staleTime: Number.POSITIVE_INFINITY,
  });

  const { data: tweetsItems } = useQuery({
    queryKey: ["social-feed", { contentType: "tweet" }],
    queryFn: () => fetchAnalyzedFeed({ limit: 50, contentType: "tweet" }),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const { data: redditItems } = useQuery({
    queryKey: ["social-feed", { contentType: "reddit_post" }],
    queryFn: () => fetchAnalyzedFeed({ limit: 50, contentType: "reddit_post" }),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const { data: telegramItems } = useQuery({
    queryKey: ["social-feed", { contentType: "telegram_message" }],
    queryFn: () =>
      fetchAnalyzedFeed({ limit: 50, contentType: "telegram_message" }),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const { data: newsItems } = useQuery({
    queryKey: ["social-feed", { contentType: "news" }],
    queryFn: () => fetchAnalyzedFeed({ limit: 50, contentType: "news" }),
    staleTime: Number.POSITIVE_INFINITY,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-2xl tracking-tight">
            AI Analyzed Content Feed
          </h2>
          {wsConnected ? (
            <div className="flex items-center gap-1 text-green-500 text-xs">
              <Wifi className="h-3 w-3" />
              <span>Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </div>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Real-time feed of all content analyzed by GPT-4
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All
            {allItems && (
              <Badge className="ml-2" variant="secondary">
                {allItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tweets">
            Tweets
            {tweetsItems && (
              <Badge className="ml-2" variant="secondary">
                {tweetsItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reddit">
            Reddit
            {redditItems && (
              <Badge className="ml-2" variant="secondary">
                {redditItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="telegram">
            Telegram
            {telegramItems && (
              <Badge className="ml-2" variant="secondary">
                {telegramItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="news">
            News
            {newsItems && (
              <Badge className="ml-2" variant="secondary">
                {newsItems.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {isLoadingAll && (
                <>
                  <FeedSkeleton />
                  <FeedSkeleton />
                  <FeedSkeleton />
                </>
              )}
              {!isLoadingAll &&
                allItems &&
                allItems.length > 0 &&
                allItems.map((item) => <FeedItem item={item} key={item.id} />)}
              {!isLoadingAll && (!allItems || allItems.length === 0) && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">
                      No analyzed content yet. Content will appear here as it's
                      analyzed.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tweets">
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {tweetsItems && tweetsItems.length > 0 ? (
                tweetsItems.map((item) => (
                  <FeedItem item={item} key={item.id} />
                ))
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">
                      No tweets analyzed yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="reddit">
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {redditItems && redditItems.length > 0 ? (
                redditItems.map((item) => (
                  <FeedItem item={item} key={item.id} />
                ))
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">
                      No Reddit posts analyzed yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="telegram">
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {telegramItems && telegramItems.length > 0 ? (
                telegramItems.map((item) => (
                  <FeedItem item={item} key={item.id} />
                ))
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">
                      No Telegram messages analyzed yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="news">
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {newsItems && newsItems.length > 0 ? (
                newsItems.map((item) => <FeedItem item={item} key={item.id} />)
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">
                      No news analyzed yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
