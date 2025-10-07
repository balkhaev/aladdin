import { Plus } from "lucide-react";
import { useState } from "react";
import { useCreateExchangeCredential } from "../hooks/use-exchange-credentials";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";

export function AddExchangeCredentialDialog() {
  const [open, setOpen] = useState(false);
  const [exchange, setExchange] = useState("binance");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testnet, setTestnet] = useState(false);

  const createMutation = useCreateExchangeCredential();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createMutation.mutate(
      {
        exchange,
        label,
        apiKey,
        apiSecret,
        testnet,
      },
      {
        onSuccess: () => {
          setOpen(false);
          // Reset form
          setExchange("binance");
          setLabel("");
          setApiKey("");
          setApiSecret("");
          setTestnet(false);
        },
      }
    );
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add API Key
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Exchange API Key</DialogTitle>
            <DialogDescription>
              Add your exchange API credentials to start trading. Your API
              secret will be encrypted before storage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="exchange">Exchange</Label>
              <Select onValueChange={setExchange} value={exchange}>
                <SelectTrigger id="exchange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="binance">Binance</SelectItem>
                  <SelectItem value="bybit">Bybit</SelectItem>
                  <SelectItem disabled value="okx">
                    OKX (Coming soon)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Main Trading Account"
                required
                value={label}
              />
              <p className="text-muted-foreground text-xs">
                A friendly name to identify this API key
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                required
                value={apiKey}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiSecret">API Secret</Label>
              <Input
                id="apiSecret"
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter your API secret"
                required
                type="password"
                value={apiSecret}
              />
              <p className="text-muted-foreground text-xs">
                Your secret will be encrypted with AES-256-GCM
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={testnet}
                id="testnet"
                onCheckedChange={setTestnet}
              />
              <Label className="cursor-pointer font-normal" htmlFor="testnet">
                Use Testnet
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={createMutation.isPending} type="submit">
              {createMutation.isPending ? "Adding..." : "Add API Key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
