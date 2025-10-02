import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import { Button } from "./ui/button";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/market", label: "Market" },
    { to: "/market-analytics", label: "Analytics+" },
    { to: "/trading", label: "Trading" },
    { to: "/screener", label: "Screener" },
    { to: "/portfolio", label: "Portfolio" },
    { to: "/analytics", label: "Analytics" },
    { to: "/backtest", label: "Backtest" },
    { to: "/on-chain", label: "On-Chain" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button size="icon" variant="ghost">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
