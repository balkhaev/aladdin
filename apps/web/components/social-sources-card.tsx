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

  // Защита от неправильной структуры данных
  const safeData = data
    ? {
        ...data,
        queues: Array.isArray(data.queues) ? data.queues : null,
        news: data.news
          ? {
              ...data.news,
              sources: Array.isArray(data.news.sources)
                ? data.news.sources.filter(
                    (s): s is { name: string; enabled: boolean } =>
                      typeof s === "object" && s !== null && "name" in s
                  )
                : [],
            }
          : null,
      }
    : null;

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

  if (error || !safeData) {
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
            <span>
              {error instanceof Error
                ? `Ошибка: ${error.message}`
                : "Не удалось загрузить статус источников. Scraper service может быть недоступен."}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const queues = safeData.queues ?? [];
  const totalPending = queues.reduce((sum, q) => sum + q.pending, 0);
  const totalActive = queues.reduce((sum, q) => sum + q.active, 0);
  const totalCompleted = queues.reduce((sum, q) => sum + q.completed, 0);

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
        {safeData.queues && queues.length > 0 && (
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
        {safeData.reddit && (
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-orange-500" />
                <span className="font-medium text-sm">Reddit</span>
              </div>
              <Badge
                className={
                  safeData.reddit.running ? "bg-green-500/20" : "bg-gray-500/20"
                }
                variant="outline"
              >
                {safeData.reddit.running ? "Активен" : "Неактивен"}
              </Badge>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сабреддиты</span>
                <span>{safeData.reddit.subreddits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Лимит постов</span>
                <span>{safeData.reddit.postsLimit}</span>
              </div>
            </div>
          </div>
        )}

        {/* News Status */}
        {safeData.news && (
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper className="size-4 text-blue-500" />
                <span className="font-medium text-sm">Новости</span>
              </div>
              <Badge
                className={
                  safeData.news.running ? "bg-green-500/20" : "bg-gray-500/20"
                }
                variant="outline"
              >
                {safeData.news.running ? "Активен" : "Неактивен"}
              </Badge>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Источники</span>
                <span>{safeData.news.sources.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Лимит статей</span>
                <span>{safeData.news.articlesLimit}</span>
              </div>
            </div>
            {safeData.news.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {safeData.news.sources.slice(0, 3).map((source) => (
                  <Badge
                    className="text-xs"
                    key={source.name}
                    variant="secondary"
                  >
                    {source.name}
                  </Badge>
                ))}
                {safeData.news.sources.length > 3 && (
                  <Badge className="text-xs" variant="secondary">
                    +{safeData.news.sources.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-center text-muted-foreground text-xs">
          Обновлено:{" "}
          {new Date(safeData.timestamp).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
      </CardContent>
    </Card>
  );
}
