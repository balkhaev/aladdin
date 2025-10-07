import { format } from "date-fns";
import { Key, MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  useDeleteExchangeCredential,
  useExchangeCredentials,
  useUpdateExchangeCredential,
} from "../hooks/use-exchange-credentials";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Skeleton } from "./ui/skeleton";
import { Switch } from "./ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export function ExchangeCredentialsList() {
  const { data: credentials, isLoading } = useExchangeCredentials();
  const updateMutation = useUpdateExchangeCredential();
  const deleteMutation = useDeleteExchangeCredential();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<string | null>(
    null
  );

  const handleToggleActive = (id: string, isActive: boolean) => {
    updateMutation.mutate({ id, data: { isActive: !isActive } });
  };

  const handleDelete = (id: string) => {
    setCredentialToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (credentialToDelete) {
      deleteMutation.mutate(credentialToDelete);
      setDeleteDialogOpen(false);
      setCredentialToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Exchange API Keys
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

  if (!credentials || credentials.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Exchange API Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Key className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p className="font-medium text-lg">No API keys added yet</p>
            <p className="mt-1 text-sm">
              Add your exchange API keys to start trading
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Exchange API Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exchange</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((cred) => (
                <TableRow key={cred.id}>
                  <TableCell className="font-medium capitalize">
                    {cred.exchange}
                  </TableCell>
                  <TableCell>{cred.label}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {cred.apiKey.substring(0, 8)}...
                    {cred.apiKey.substring(cred.apiKey.length - 4)}
                  </TableCell>
                  <TableCell>
                    {cred.testnet ? (
                      <Badge variant="secondary">Testnet</Badge>
                    ) : (
                      <Badge variant="default">Production</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={cred.isActive}
                        onCheckedChange={() =>
                          handleToggleActive(cred.id, cred.isActive)
                        }
                      />
                      <span className="text-muted-foreground text-sm">
                        {cred.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(cred.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(cred.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The API key will be permanently
              removed and you will not be able to trade with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
