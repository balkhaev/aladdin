/**
 * Social Sources Card
 * Display status of all social data sources
 */

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  MessageSquare,
  Newspaper,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrapersOverview } from "@/hooks/use-scrapers-overview";

export function SocialSourcesCard() {
  const { data, isLoading, error } = useScrapersOverview();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            Источники данных
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            Источники данных
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertCircle className="size-4" />
            <span>Не удалось загрузить статус источников</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const queueEntries = data.queues ? Object.entries(data.queues) : [];
  const totalPending = queueEntries.reduce(
    (sum, [, stats]) => sum + stats.pending,
    0
  );
  const totalActive = queueEntries.reduce(
    (sum, [, stats]) => sum + stats.active,
    0
  );
  const totalCompleted = queueEntries.reduce(
    (sum, [, stats]) => sum + stats.completed,
    0
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="size-5" />
            Источники данных
          </CardTitle>
          {totalActive > 0 ? (
            <Badge className="flex items-center gap-1" variant="default">
              <Activity className="size-3 animate-pulse" />
              Активно
            </Badge>
          ) : (
            <Badge className="flex items-center gap-1" variant="secondary">
              <CheckCircle2 className="size-3" />В режиме ожидания
            </Badge>
          )}
        </div>
        <p className="mt-1 text-muted-foreground text-xs">
          Статус всех источников социальных данных
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Queue Statistics */}
        {data.queues && queueEntries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Очереди обработки</span>
              {totalActive > 0 && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/50 p-3">
              <div className="text-center">
                <p className="text-muted-foreground text-xs">В очереди</p>
                <p className="mt-1 font-bold text-lg">{totalPending}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-xs">Обработка</p>
                <p className="mt-1 font-bold text-blue-500 text-lg">
                  {totalActive}
                </p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-xs">Завершено</p>
                <p className="mt-1 font-bold text-green-500 text-lg">
                  {totalCompleted}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reddit Status */}
        {data.reddit && (
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-orange-500" />
                <span className="font-medium text-sm">Reddit</span>
              </div>
              <Badge variant="outline">
                {data.reddit.postsCollected} постов
              </Badge>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сабреддиты</span>
                <span>{data.reddit.subreddits.length}</span>
              </div>
              {data.reddit.lastScraped && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Последний сбор</span>
                  <span>
                    {new Date(data.reddit.lastScraped).toLocaleTimeString(
                      "ru-RU",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                </div>
              )}
            </div>
            {data.reddit.subreddits.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {data.reddit.subreddits.slice(0, 3).map((sub) => (
                  <Badge className="text-xs" key={sub} variant="secondary">
                    r/{sub}
                  </Badge>
                ))}
                {data.reddit.subreddits.length > 3 && (
                  <Badge className="text-xs" variant="secondary">
                    +{data.reddit.subreddits.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* News Status */}
        {data.news && (
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper className="size-4 text-blue-500" />
                <span className="font-medium text-sm">Новости</span>
              </div>
              <Badge variant="outline">
                {data.news.articlesCollected} статей
              </Badge>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Источники</span>
                <span>{data.news.sources.length}</span>
              </div>
              {data.news.lastScraped && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Последний сбор</span>
                  <span>
                    {new Date(data.news.lastScraped).toLocaleTimeString(
                      "ru-RU",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                </div>
              )}
            </div>
            {data.news.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {data.news.sources.slice(0, 3).map((source) => (
                  <Badge className="text-xs" key={source} variant="secondary">
                    {source}
                  </Badge>
                ))}
                {data.news.sources.length > 3 && (
                  <Badge className="text-xs" variant="secondary">
                    +{data.news.sources.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-center text-muted-foreground text-xs">
          Обновлено:{" "}
          {new Date(data.timestamp).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
      </CardContent>
    </Card>
  );
}
