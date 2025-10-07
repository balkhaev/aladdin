import { useCallback, useRef } from "react";

/**
 * Hook для троттлинга функции
 * Ограничивает частоту вызова функции
 *
 * @param callback - функция для троттлинга
 * @param delay - минимальная задержка между вызовами в миллисекундах
 * @returns троттлированная функция
 *
 * @example
 * ```tsx
 * const handleScroll = useThrottle(() => {
 *   console.log('Scrolling...');
 * }, 200);
 *
 * return <div onScroll={handleScroll}>...</div>;
 * ```
 */
export function useThrottle<T extends (...args: unknown[]) => void>(
  callback: T,
  delay = 200
): T {
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  return useCallback(
    ((...args) => {
      const elapsed = Date.now() - lastRun.current;

      if (elapsed >= delay) {
        callback(...args);
        lastRun.current = Date.now();
      } else {
        // Очищаем предыдущий таймаут
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Устанавливаем новый таймаут для следующего вызова
        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastRun.current = Date.now();
        }, delay - elapsed);
      }
    }) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}

/**
 * Hook для троттлинга значения
 *
 * @param value - значение для троттлинга
 * @param delay - минимальная задержка между обновлениями
 * @returns троттлированное значение
 */
export function useThrottleValue<T>(value: T, delay = 200): T {
  const throttledRef = useRef(value);
  const lastUpdate = useRef(Date.now());

  if (Date.now() - lastUpdate.current >= delay) {
    throttledRef.current = value;
    lastUpdate.current = Date.now();
  }

  return throttledRef.current;
}
