import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CompactCardProps = HTMLAttributes<HTMLDivElement>;

const CompactCard = ({ className, ...props }: CompactCardProps) => (
  <div
    className={cn(
      "rounded-md border border-border/50 bg-card/30 backdrop-blur-sm",
      className
    )}
    {...props}
  />
);

type CompactCardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
};

const CompactCardHeader = ({
  className,
  action,
  children,
  ...props
}: CompactCardHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between border-border/30 border-b px-3 py-2",
      className
    )}
    {...props}
  >
    <div className="flex-1">{children}</div>
    {action && <div className="ml-2">{action}</div>}
  </div>
);

type CompactCardTitleProps = HTMLAttributes<HTMLHeadingElement>;

const CompactCardTitle = ({ className, ...props }: CompactCardTitleProps) => (
  <h3
    className={cn(
      "font-semibold text-muted-foreground text-xs uppercase tracking-wide",
      className
    )}
    {...props}
  />
);

type CompactCardContentProps = HTMLAttributes<HTMLDivElement>;

const CompactCardContent = ({
  className,
  ...props
}: CompactCardContentProps) => (
  <div className={cn("p-3", className)} {...props} />
);

export { CompactCard, CompactCardHeader, CompactCardTitle, CompactCardContent };
