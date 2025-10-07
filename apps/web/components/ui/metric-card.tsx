/**
 * MetricCard Component
 * Reusable card component for displaying metrics with consistent styling
 */

import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { createElement, isValidElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Skeleton } from "./skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

type MetricCardProps = {
  /**
   * Title of the metric
   */
  title: string;

  /**
   * Main value to display
   */
  value: string | number;

  /**
   * Optional description or subtitle
   */
  description?: string;

  /**
   * Optional icon to display next to the title
   * Can be a LucideIcon component or any React node
   */
  icon?: LucideIcon | React.ReactNode;

  /**
   * Optional change value (for trends)
   */
  change?: number;

  /**
   * Optional change label
   */
  changeLabel?: string;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Optional footer content
   */
  footer?: React.ReactNode;

  /**
   * Optional tooltip text for the title
   */
  tooltip?: string;

  /**
   * Color variant
   */
  variant?: "default" | "success" | "warning" | "danger";

  /**
   * Custom className for the value
   */
  valueClassName?: string;

  /**
   * Additional CSS classes
   */
  className?: string;
};

const VARIANT_CLASSES = {
  default: "",
  success: "border-green-500/20 bg-green-500/5",
  warning: "border-yellow-500/20 bg-yellow-500/5",
  danger: "border-red-500/20 bg-red-500/5",
};

/**
 * MetricCard - Displays a metric with optional trend indicator
 *
 * @example
 * ```tsx
 * <MetricCard
 *   title="Total Volume"
 *   value="$1.2M"
 *   change={12.5}
 *   changeLabel="vs last week"
 *   icon={TrendingUp}
 * />
 * ```
 */
export function MetricCard({
  title,
  value,
  description,
  icon,
  change,
  changeLabel,
  loading = false,
  footer,
  tooltip,
  variant = "default",
  valueClassName,
  className,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">{title}</CardTitle>
          {icon && (
            <div className="text-muted-foreground">
              {isValidElement(icon)
                ? icon
                : createElement(icon as LucideIcon, { className: "size-4" })}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          {description && <Skeleton className="mt-1 h-4 w-32" />}
        </CardContent>
      </Card>
    );
  }

  let changeColor = "";
  if (change !== undefined) {
    if (change > 0) {
      changeColor = "text-green-600";
    } else if (change < 0) {
      changeColor = "text-red-600";
    } else {
      changeColor = "text-muted-foreground";
    }
  }

  const titleElement = (
    <CardTitle className="font-medium text-sm">{title}</CardTitle>
  );

  return (
    <Card className={`${VARIANT_CLASSES[variant]} ${className || ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        {tooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">{titleElement}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          titleElement
        )}
        {icon && (
          <div className="text-muted-foreground">
            {isValidElement(icon)
              ? icon
              : createElement(icon as LucideIcon, { className: "size-4" })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className={`font-bold text-2xl ${valueClassName || ""}`}>
          {value}
        </div>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${changeColor}`}>
            {change > 0 && <ArrowUp className="size-3" />}
            {change < 0 && <ArrowDown className="size-3" />}
            <span>
              {change > 0 ? "+" : ""}
              {change.toFixed(2)}%
            </span>
            {changeLabel && (
              <span className="text-muted-foreground">{changeLabel}</span>
            )}
          </div>
        )}
        {footer && <div className="mt-4">{footer}</div>}
      </CardContent>
    </Card>
  );
}

/**
 * MetricCardGrid - Container for displaying multiple metrics in a grid
 */
export function MetricCardGrid({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
}) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return <div className={`grid gap-4 ${gridCols[columns]}`}>{children}</div>;
}
