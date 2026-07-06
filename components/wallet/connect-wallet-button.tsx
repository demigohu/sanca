"use client";

import React from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Copy, History, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { formatAddress } from "@/lib/utils";

export default function ConnectWalletButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address, creating } = useStellarWallet();
  const [copied, setCopied] = React.useState(false);

  const handleCopyAddress = React.useCallback(async (addr?: string | null) => {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }, []);

  if (!ready) {
    return (
      <Button size="sm" variant="outline" disabled>
        Loading…
      </Button>
    );
  }

  if (!authenticated) {
    return (
      <Button size="sm" variant="outline" onClick={login}>
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          {creating ? "Setting up…" : address ? formatAddress(address, 8, 4) : "Wallet"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded">
        <DropdownMenuGroup>
          <Link href="/profile">
            <DropdownMenuItem className="flex items-center justify-between cursor-pointer group">
              Profile
              <User className="w-4 h-4 group-hover:text-white" />
            </DropdownMenuItem>
          </Link>
          <Link href="/activity">
            <DropdownMenuItem className="flex items-center justify-between cursor-pointer group">
              Activity
              <History className="w-4 h-4 group-hover:text-white" />
            </DropdownMenuItem>
          </Link>
          {address && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleCopyAddress(address);
              }}
              className="flex items-center justify-between cursor-pointer group"
            >
              {formatAddress(address, 8, 6)}
              {copied ? (
                <Check className="w-4 h-4 group-hover:text-white" />
              ) : (
                <Copy className="w-4 h-4 group-hover:text-white" />
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuLabel className="flex items-center gap-2">
            <span className="font-medium">Network</span>
            <DropdownMenuShortcut className="tracking-normal">Stellar Testnet</DropdownMenuShortcut>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          variant="destructive"
          onSelect={(e) => {
            e.preventDefault();
            logout();
          }}
        >
          Disconnect
          <LogOut className="w-4 h-4" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
