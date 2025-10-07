/**
 * StatusBadge Component
 * Reusable badge component for displaying various status types with consistent styling
 */

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import { Badge } from "./badge";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type StatusConfig = {
  variant: BadgeVariant;
  label: string;
  icon?: LucideIcon;
};

// Predefined status configurations for common use cases
export const STATUS_CONFIGS: Record<string, StatusConfig> = {
  // Order statuses
  pending: { variant: "default", label: "Ожидает", icon: Clock },
  open: { variant: "secondary", label: "Открыт", icon: Clock },
  filled: { variant: "default", label: "Исполнен", icon: CheckCircle2 },
  partially_filled: {
    variant: "secondary",
    label: "Частично исполнен",
    icon: Clock,
  },
  cancelled: { variant: "outline", label: "Отменён", icon: XCircle },
  rejected: { variant: "destructive", label: "Отклонён", icon: AlertCircle },
  expired: { variant: "outline", label: "Истёк", icon: XCircle },

  // Position statuses
  active: { variant: "default", label: "Активна", icon: CheckCircle2 },
  closed: { variant: "outline", label: "Закрыта" },
  liquidated: { variant: "destructive", label: "Ликвидирована" },

  // Trading side
  buy: { variant: "default", label: "Покупка" },
  sell: { variant: "destructive", label: "Продажа" },
  long: { variant: "default", label: "Long" },
  short: { variant: "destructive", label: "Short" },

  // System statuses
  online: { variant: "default", label: "Онлайн" },
  offline: { variant: "outline", label: "Оффлайн" },
  error: { variant: "destructive", label: "Ошибка", icon: AlertCircle },
  warning: { variant: "secondary", label: "Предупреждение", icon: AlertCircle },
  success: { variant: "default", label: "Успешно", icon: CheckCircle2 },

  // Processing statuses
  processing: { variant: "secondary", label: "Обработка", icon: Clock },
  completed: { variant: "default", label: "Завершено", icon: CheckCircle2 },
  failed: { variant: "destructive", label: "Не удалось", icon: XCircle },
};

type StatusBadgeProps = {
  /**
   * The status key to look up in STATUS_CONFIGS
   * Can be any of the predefined statuses or a custom value
   */
  status: string;

  /**
   * Optional override configuration
   * Allows customizing the badge appearance for specific use cases
   */
  config?: Partial<StatusConfig>;

  /**
   * Additional CSS classes to apply
   */
  className?: string;

  /**
   * Size variant for the badge
   */
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASSES = {
  sm: "h-5 text-[10px] px-1.5",
  md: "h-6 text-xs px-2",
  lg: "h-7 text-sm px-3",
};

/**
 * StatusBadge - Displays a status with consistent styling
 *
 * @example
 * ```tsx
 * // Using predefined status
 * <StatusBadge status="pending" />
 *
 * // With custom configuration
 * <StatusBadge
 *   status="custom"
 *   config={{ variant: "default", label: "Custom Status", icon: CheckIcon }}
 * />
 *
 * // With size
 * <StatusBadge status="active" size="lg" />
 * ```
 */
export function StatusBadge({
  status,
  config,
  className,
  size = "md",
}: StatusBadgeProps) {
  // Get default config from predefined statuses (case-insensitive)
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, "_");
  const defaultConfig = STATUS_CONFIGS[normalizedStatus] || {
    variant: "outline" as BadgeVariant,
    label: status,
  };

  // Merge with custom config if provided
  const finalConfig = { ...defaultConfig, ...config };
  const Icon = finalConfig.icon;

  return (
    <Badge
      className={`${SIZE_CLASSES[size]} gap-1 ${className || ""}`}
      variant={finalConfig.variant}
    >
      {Icon && <Icon className="size-3" />}
      {finalConfig.label}
    </Badge>
  );
}
