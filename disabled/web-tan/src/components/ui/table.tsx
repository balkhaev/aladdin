import type * as React from "react";

import { cn } from "@/lib/utils";

type TableProps = React.ComponentProps<"table"> & {
  compact?: boolean;
};

function Table({ className, compact, ...props }: TableProps) {
  return (
    <div
      className="relative w-full overflow-x-auto"
      data-slot="table-container"
    >
      <table
        className={cn(
          "w-full caption-bottom",
          compact ? "text-xs" : "text-sm",
          className
        )}
        data-compact={compact}
        data-slot="table"
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("[&_tr]:border-b", className)}
      data-slot="table-header"
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      data-slot="table-body"
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      data-slot="table-footer"
      {...props}
    />
  );
}

type TableRowProps = React.ComponentProps<"tr"> & {
  compact?: boolean;
};

function TableRow({ className, compact, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        compact && "h-8",
        className
      )}
      data-slot="table-row"
      {...props}
    />
  );
}

type TableHeadProps = React.ComponentProps<"th"> & {
  compact?: boolean;
};

function TableHead({ className, compact, ...props }: TableHeadProps) {
  return (
    <th
      className={cn(
        "whitespace-nowrap text-left align-middle font-medium text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        compact ? "h-7 px-1.5 text-[10px]" : "h-10 px-2",
        className
      )}
      data-slot="table-head"
      {...props}
    />
  );
}

type TableCellProps = React.ComponentProps<"td"> & {
  compact?: boolean;
};

function TableCell({ className, compact, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        "whitespace-nowrap align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        compact ? "px-1.5 py-1" : "p-2",
        className
      )}
      data-slot="table-cell"
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      className={cn("mt-4 text-muted-foreground text-sm", className)}
      data-slot="table-caption"
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
