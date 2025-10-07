import { API_CONFIG } from "../config";

/**
 * Стандартный формат ответа от API Gateway
 */
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
};

/**
 * Кастомная ошибка API
 */
export class ApiError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Опции для API запроса
 */
type RequestOptions = RequestInit & {
  timeout?: number;
};

/**
 * Базовая функция для выполнения API запросов через Gateway
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeout = API_CONFIG.REQUEST_TIMEOUT, ...fetchOptions } = options;

  // Создаем URL
  const url = `${API_CONFIG.BASE_URL}${path}`;

  // Настраиваем таймаут
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      credentials: "include", // Отправляем cookies с сессией
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Парсим ответ
    let data: ApiResponse<T>;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        "PARSE_ERROR",
        "Failed to parse response",
        response.status
      );
    }

    // Проверяем успешность
    if (!response.ok) {
      throw new ApiError(
        data.error?.code || "UNKNOWN_ERROR",
        data.error?.message || "Request failed",
        response.status
      );
    }

    if (!data.success) {
      throw new ApiError(
        data.error?.code || "UNKNOWN_ERROR",
        data.error?.message || "Request failed",
        response.status
      );
    }

    // Return data (allow empty arrays and null for valid empty responses)
    return data.data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    // Обрабатываем таймаут
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("TIMEOUT", "Request timeout");
    }

    // Обрабатываем сетевые ошибки
    if (error instanceof TypeError) {
      throw new ApiError("NETWORK_ERROR", "Network error");
    }

    // Пробрасываем ApiError дальше
    if (error instanceof ApiError) {
      throw error;
    }

    // Неизвестная ошибка
    throw new ApiError(
      "UNKNOWN_ERROR",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * GET запрос
 */
export function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: RequestOptions
): Promise<T> {
  // Добавляем query parameters
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      // Пропускаем undefined и null значения
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
  }

  const urlPath = searchParams.toString()
    ? `${path}?${searchParams.toString()}`
    : path;

  return apiRequest<T>(urlPath, {
    ...options,
    method: "GET",
  });
}

/**
 * POST запрос
 */
export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT запрос
 */
export function apiPut<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE запрос
 */
export function apiDelete<T>(
  path: string,
  options?: RequestOptions
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: "DELETE",
  });
}

/**
 * PATCH запрос
 */
export function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

// API Client object for convenience
export const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
  patch: apiPatch,
};
