/**
 * Exchange Selector Component
 * Позволяет выбрать exchange credential для работы с ордерами/позициями
 */

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getExchangeCredentials } from "@/lib/api/exchange-credentials";
import { useExchange } from "@/lib/exchange-context";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function ExchangeSelector() {
  const [open, setOpen] = useState(false);
  const { selectedCredential, setSelectedCredential, isInitialized } =
    useExchange();

  const { data: credentials, isLoading } = useQuery({
    queryKey: ["exchange-credentials"],
    queryFn: getExchangeCredentials,
  });

  // Auto-select first credential if none selected
  useEffect(() => {
    if (
      isInitialized &&
      !selectedCredential &&
      credentials &&
      credentials.length > 0
    ) {
      const activeCredentials = credentials.filter((c) => c.isActive);
      const firstCredential =
        activeCredentials.length > 0 ? activeCredentials[0] : credentials[0];
      setSelectedCredential(firstCredential);
    }
  }, [isInitialized, selectedCredential, credentials, setSelectedCredential]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-muted-foreground text-sm">Загрузка...</span>
      </div>
    );
  }

  if (!credentials || credentials.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">Нет подключенных бирж</div>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="w-[200px] justify-between"
          role="combobox"
          size="sm"
          variant="outline"
        >
          {selectedCredential ? (
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {selectedCredential.exchange.toUpperCase()}
              </span>
              <span className="text-muted-foreground">
                ({selectedCredential.label})
              </span>
            </div>
          ) : (
            "Выбрать биржу"
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Поиск биржи..." />
          <CommandList>
            <CommandEmpty>Биржа не найдена</CommandEmpty>
            <CommandGroup>
              {credentials.map((credential) => (
                <CommandItem
                  key={credential.id}
                  onSelect={() => {
                    setSelectedCredential(
                      credential.id === selectedCredential?.id
                        ? null
                        : credential
                    );
                    setOpen(false);
                  }}
                  value={credential.id}
                >
                  <Check
                    className={`mr-2 size-4 ${
                      selectedCredential?.id === credential.id
                        ? "opacity-100"
                        : "opacity-0"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {credential.exchange.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {credential.label}
                      {credential.category === "linear"
                        ? " (Futures)"
                        : " (Spot)"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
