/**
 * CardSkeleton - Reusable skeleton loader for card components
 * Reduces duplication of loading states across components
 */

import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Skeleton } from "./skeleton";

type CardSkeletonProps = {
  title?: string;
  icon?: React.ReactNode;
  rows?: number;
  showHeader?: boolean;
  contentHeight?: string;
  className?: string;
};

export function CardSkeleton({
  title,
  icon,
  rows = 3,
  showHeader = true,
  contentHeight,
  className,
}: CardSkeletonProps) {
  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-2">
          {title ? (
            <CardTitle className="flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
          ) : (
            <Skeleton className="h-5 w-32" />
          )}
        </CardHeader>
      )}
      <CardContent>
        {contentHeight ? (
          <Skeleton className={contentHeight} />
        ) : (
          <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton className="h-8 w-full" key={i} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
