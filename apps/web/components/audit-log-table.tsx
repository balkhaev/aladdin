import { format } from "date-fns";
import { FileText } from "lucide-react";
import { useAuditLogs } from "../hooks/use-exchange-credentials";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export function AuditLogTable() {
  const { data, isLoading } = useAuditLogs({
    resource: "exchange_credentials",
    limit: 20,
  });

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "CREATE":
        return "default";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <FileText className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p className="font-medium text-lg">No activity yet</p>
            <p className="mt-1 text-sm">
              Activity will appear here when you manage your API keys
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Badge variant={getActionBadgeVariant(log.action)}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  {log.details && (
                    <div className="text-sm">
                      {log.action === "CREATE" && (
                        <span>
                          Added {(log.details as any).exchange} key:{" "}
                          <span className="font-medium">
                            {(log.details as any).label}
                          </span>
                          {(log.details as any).testnet && " (Testnet)"}
                        </span>
                      )}
                      {log.action === "UPDATE" && (
                        <span>
                          Updated{" "}
                          {Array.isArray((log.details as any).changes)
                            ? (log.details as any).changes.join(", ")
                            : "credentials"}
                        </span>
                      )}
                      {log.action === "DELETE" && (
                        <span>
                          Deleted {(log.details as any).exchange} key:{" "}
                          <span className="font-medium">
                            {(log.details as any).label}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
