/**
 * Social Feed WebSocket Hook
 * Real-time updates for new analyzed social content
 */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { useWebSocketSubscription } from "./use-websocket";

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

type SocialFeedEvent = {
  type: "social-content";
  event: "content.analyzed";
  data: AnalyzedContent;
  timestamp: number;
};

/**
 * Hook для real-time обновлений новых проанализированных постов
 *
 * @param contentType - Тип контента для фильтрации (опционально)
 * @param enabled - Включить подписку на обновления
 *
 * @example
 * ```tsx
 * const { isConnected, newContent } = useSocialFeedWebSocket("tweet", true);
 * ```
 */
export function useSocialFeedWebSocket(contentType?: string, enabled = true) {
  const queryClient = useQueryClient();

  const { status, data, error, isConnected } =
    useWebSocketSubscription<SocialFeedEvent>(
      "social-feed",
      enabled ? {} : undefined
    );

  // Обработка новых проанализированных постов
  useEffect(() => {
    if (!data || data.type !== "social-content") {
      return;
    }

    if (data.event !== "content.analyzed") {
      return;
    }

    logger.debug("Social Feed WS", "Received new content", {
      contentType: data.data.contentType,
      symbols: data.data.symbols,
    });

    // Если фильтр по типу задан и это не тот тип - пропускаем
    if (contentType && data.data.contentType !== contentType) {
      return;
    }

    // Обновляем кеш React Query - добавляем новый пост в начало списка
    queryClient.setQueryData(
      ["social-feed", { contentType }],
      (oldData: { data: { items: AnalyzedContent[] } } | undefined) => {
        if (!oldData) {
          return {
            data: {
              items: [data.data],
            },
          };
        }

        // Проверяем, что этот пост еще не в списке
        const existingIndex = oldData.data.items.findIndex(
          (item) => item.id === data.data.id
        );

        if (existingIndex >= 0) {
          // Уже есть в списке, не добавляем
          return oldData;
        }

        // Добавляем новый пост в начало
        return {
          data: {
            items: [data.data, ...oldData.data.items],
          },
        };
      }
    );

    // Также инвалидируем общий список без фильтра
    if (contentType) {
      queryClient.invalidateQueries({
        queryKey: ["social-feed", {}],
      });
    }
  }, [data, queryClient, contentType]);

  return {
    status,
    error,
    isConnected: isConnected && enabled,
    newContent: data?.data,
  };
}
