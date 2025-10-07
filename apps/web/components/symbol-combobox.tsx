/**
 * Symbol Combobox Component
 * Searchable dropdown for selecting trading symbols
 */

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";
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

type Symbol = {
  value: string;
  label: string;
};

type SymbolComboboxProps = {
  symbols?: Symbol[];
  value: string;
  onValueChange: (value: string) => void;
};

export function SymbolCombobox({
  symbols = [],
  value,
  onValueChange,
}: SymbolComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedSymbol = symbols.find((symbol) => symbol.value === value);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-label="Выбрать символ"
          className="w-[200px] justify-between"
          role="combobox"
          variant="outline"
        >
          {selectedSymbol ? selectedSymbol.label : "Выберите символ..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Поиск символа..." />
          <CommandList>
            <CommandEmpty>Символ не найден.</CommandEmpty>
            <CommandGroup>
              {symbols.map((symbol) => (
                <CommandItem
                  key={symbol.value}
                  onSelect={() => {
                    onValueChange(symbol.value);
                    setOpen(false);
                  }}
                  value={symbol.value}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === symbol.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {symbol.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
