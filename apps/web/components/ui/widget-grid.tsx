import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type WidgetGridProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 2 | 3 | 4 | 6;
};

const WidgetGrid = ({ className, columns = 3, ...props }: WidgetGridProps) => {
  const gridClasses = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  };

  return (
    <div
      className={cn("grid gap-2", gridClasses[columns], className)}
      {...props}
    />
  );
};

export { WidgetGrid };
