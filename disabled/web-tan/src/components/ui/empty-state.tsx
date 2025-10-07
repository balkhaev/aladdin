/**
 * EmptyState - Reusable empty state component
 * Provides consistent empty state UI across the application
 */

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "./card";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center py-12">
        {Icon && (
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
            <Icon className="size-8 text-muted-foreground" />
          </div>
        )}
        <h3 className="font-semibold text-lg">{title}</h3>
        {description && (
          <p className="mt-2 text-center text-muted-foreground text-sm">
            {description}
          </p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </CardContent>
    </Card>
  );
}
