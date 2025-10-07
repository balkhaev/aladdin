import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api/client";

const STALE_TIME_MS = 5000; // 5 секунд
const SECONDS_IN_MINUTE = 60;
const MS_IN_SECOND = 1000;
const GC_TIME_MS = 10 * SECONDS_IN_MINUTE * MS_IN_SECOND; // 10 минут
const MIN_CLIENT_ERROR_CODE = 400;
const MAX_CLIENT_ERROR_CODE = 500;
const MAX_RETRY_DELAY_MS = 30_000; // 30 секунд
const INITIAL_RETRY_DELAY_MS = 1000; // 1 секунда

/**
 * Создает индивидуальный экземпляр QueryClient с согласованной конфигурацией.
 * Экспортируется как фабрика, чтобы на сервере не происходило утечек состояния
 * между запросами, но при этом есть готовый singleton для клиентского кода.
 */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Кэш считается устаревшим через 5 секунд
        staleTime: STALE_TIME_MS,

        // Данные хранятся в кэше 10 минут
        gcTime: GC_TIME_MS,

        // Перезапрашивать при фокусе окна
        refetchOnWindowFocus: true,

        // Перезапрашивать при восстановлении соединения
        refetchOnReconnect: true,

        // Retry логика
        retry: (failureCount, error) => {
          // Не retry для ошибок аутентификации
          if (error instanceof ApiError) {
            if (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN") {
              return false;
            }

            // Не retry для клиентских ошибок (4xx)
            const isClientError =
              error.status &&
              error.status >= MIN_CLIENT_ERROR_CODE &&
              error.status < MAX_CLIENT_ERROR_CODE;
            if (isClientError) {
              return false;
            }
          }

          // Retry только один раз для остальных ошибок
          return failureCount < 1;
        },

        // Задержка между retry (экспоненциальная)
        retryDelay: (attemptIndex) =>
          Math.min(
            INITIAL_RETRY_DELAY_MS * 2 ** attemptIndex,
            MAX_RETRY_DELAY_MS
          ),
      },

      mutations: {
        // Retry для mutations
        retry: (_failureCount, error) => {
          // Не retry для ошибок аутентификации
          if (error instanceof ApiError) {
            if (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN") {
              return false;
            }

            // Не retry для клиентских ошибок (4xx)
            const isClientError =
              error.status &&
              error.status >= MIN_CLIENT_ERROR_CODE &&
              error.status < MAX_CLIENT_ERROR_CODE;
            if (isClientError) {
              return false;
            }
          }

          // Не retry mutations по умолчанию
          return false;
        },
      },
    },
  });

/**
 * Готовый singleton для клиентской стороны (CSR).
 */
export const queryClient = createQueryClient();
