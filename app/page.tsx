"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import {
  ArrowRight,
  CheckCircle2,
  Users,
  TrendingUp,
  Lock,
  Moon,
  Sun,
  Check,
  Infinity,
  DollarSign,
  InfinityIcon,
  LockKeyhole,
  ChartColumnBig,
  Handshake,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import Image from "next/image";
import ConnectWalletButton from "@/components/wallet/connect-wallet-button";
import Navbar from "@/components/navbar";

// Reusable button component that handles wallet connection or redirect
function ActionButton({
  children,
  variant = "default",
  size = "lg",
  className = "",
  redirectTo = "/circles",
}: {
  children: React.ReactNode;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  className?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { authenticated, login } = usePrivy();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (authenticated) {
      router.push(redirectTo);
    } else {
      login();
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={handleClick}
    >
      {children}
    </Button>
  );
}

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { theme, toggleTheme, mounted } = useTheme();
  const router = useRouter();
  const { authenticated } = usePrivy();

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      {/* Navigation */}
      {/* <Navbar /> */}

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 min-h-screen flex items-center justify-center">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `
        linear-gradient(to right, rgba(148, 163, 184, 0.25) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.25) 1px, transparent 1px)
      `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 0",
            maskImage: `
        repeating-linear-gradient(
          to right,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        ),
        repeating-linear-gradient(
          to bottom,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        )
      `,
            WebkitMaskImage: `
        repeating-linear-gradient(
          to right,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        ),
        repeating-linear-gradient(
          to bottom,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        )
      `,
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }}
        />

        <div className="max-w-6xl mx-auto relative w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Composable DeFi ROSCA on Stellar
                  </span>
                </div>
                <h1 className="text-5xl sm:text-6xl font-bold text-foreground leading-tight">
                  Save Together,
                  <br />
                  <span className="text-accent">Earn Together</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-md">
                  Community savings circles built on Stellar DeFi building blocks — DeFindex
                  yield on collateral, drand-verified draws, Privy login, and Coridor IDR ramps.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <ActionButton size="lg" className="gap-2" redirectTo="/dashboard">
                  Explore Pools
                  <ArrowRight className="w-4 h-4" />
                </ActionButton>
                {/* <ActionButton size="lg" variant="outline">
                  Join Pool
                </ActionButton> */}
              </div>

              {/* <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-semibold text-foreground"
                    >
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">2,500+</span>{" "}
                  members saving together
                </p>
              </div> */}
            </div>

            {/* Hero Visual */}
            <div className="relative hidden lg:flex items-center justify-center h-96">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent rounded-full blur-3xl"></div>
              <div className="relative space-y-4">
                <div className="bg-card border border-border rounded-lg p-6 space-y-3 shadow-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Productive Pool Capital
                      </p>
                      <p className="text-2xl font-mono font-bold text-foreground">
                        25,000 USDC
                      </p>
                    </div>
                    <div className="px-2 py-1 rounded bg-accent/10 text-accent text-xs font-semibold">
                      Active
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Next Cycle Settlement
                  </p>
                    <p className="text-sm font-semibold text-foreground">
                      In 3 days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How Sanca Works */}
      <section
        id="how-it-works"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-card/50"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-foreground">
              How Sanca Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A composable ROSCA protocol: create a circle, lock collateral in DeFindex, contribute
              each cycle, and let on-chain automation settle fair payouts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: 1,
                title: "Create or Join a Pool",
                description:
                  "Create a new Sanca circle on Stellar or join an existing one with fixed membership, contribution size, and payout cadence.",
                icon: Users,
              },
              {
                step: 2,
                title: "Lock Productive Collateral",
                description:
                  "When you join, you deposit your full future contributions in USDC as collateral, and the pool routes that capital into a DeFindex yield vault.",
                icon: TrendingUp,
              },
              {
                step: 3,
                title: "Contribute and Settle Each Cycle",
                description:
                  "Each cycle, members contribute USDC while Drand-backed randomness determines a fair payout order and automated settlement advances the pool lifecycle.",
                icon: Lock,
              },
              {
                step: 4,
                title: "Monitor Yield and Withdraw",
                description:
                  "The keeper surfaces APY, vault TVL, and next actions during the run; once all cycles complete, members withdraw remaining collateral in USDC.",
                icon: CheckCircle2,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="group">
                  <div className="bg-background border border-border rounded-lg p-6 h-full hover:border-accent/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-accent" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="text-xs font-semibold text-accent uppercase tracking-wider">
                          Step {item.step}
                        </p>
                        <h3 className="font-semibold text-foreground">
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="why-choose-sanca" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-foreground">
              Why Choose Sanca
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built by composing Stellar primitives — transparent savings, fair randomness,
              productive USDC collateral, and automated settlement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Check,
                title: "On-Chain Transparency",
                description:
                  "Pool creation, contributions, settlement, and withdrawals live on Stellar and can be audited directly in-app or on Stellar Expert.",
              },
              {
                icon: InfinityIcon,
                title: "Provably Fair Draws",
                description:
                  "Drand-backed randomness seeds a pre-shuffled winner schedule for each pool, so every member wins exactly once and no one can tilt the odds.",
              },
              {
                icon: DollarSign,
                title: "Yield on Idle Capital",
                description:
                  "Upfront USDC collateral does not sit dormant. Sanca deposits it into a DeFindex vault while the circle is active.",
              },
              {
                icon: LockKeyhole,
                title: "Non-Custodial Execution",
                description:
                  "Smart contracts enforce pool rules and hold capital according to code, not a coordinator, company, or custodial backend.",
              },
              {
                icon: ChartColumnBig,
                title: "Automated Settlement",
                description:
                  "An off-chain keeper watches active pools and calls settle_cycle with a fresh drand beacon when each period ends — payouts and yield bonuses run on-chain.",
              },
              {
                icon: Handshake,
                title: "Community First",
                description:
                  "Designed for real ROSCA behavior with upfront collateral, missed-payment liquidation, automated payouts, and clear withdrawal rules.",
              },
            ].map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={idx}
                  className="bg-card border border-border rounded-lg p-6 hover:border-accent/50 transition-colors"
                >
                  <div className="mb-4">
                    <Icon className="size-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      {/* <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-6 mb-12">
            <h2 className="text-4xl font-bold text-foreground">
              See It In Action
            </h2>
            <p className="text-lg text-muted-foreground">
              Experience how a Sanca circle works with our interactive demo
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: "Active Circles",
                value: "847",
                change: "+12% this month",
              },
              { label: "Total Funds", value: "$2.3M", change: "In rotation" },
              { label: "Members", value: "12,500+", change: "Worldwide" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-background border border-border rounded-lg p-6 text-center"
              >
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-accent font-mono mb-1">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.change}</p>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* FAQ Section */}
      <section id="faqs" className="py-20 px-4 sm:px-6 lg:px-8 bg-card/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-foreground">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Find answers to common questions about Sanca&apos;s savings circles and keeper flow
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                question: "What is a Sanca pool?",
                answer:
                  "A Sanca pool is an on-chain rotating savings group (ROSCA) deployed on Stellar. Members deposit their full future contributions in USDC upfront as collateral, contribute each cycle, and the pool coordinates fair payouts while the collateral remains productive.",
              },
              {
                question: "How do I create a circle?",
                answer:
                  "Connect your wallet, click 'Create Circle', and set max members, contribution per period, and period duration. SancaFactory deploys a new SancaPool; members join by depositing full collateral.",
              },
              {
                question: "Can I join multiple pools?",
                answer:
                  "Yes. Each SancaPool is an independent Soroban smart contract. As long as you have enough USDC for collateral, you can join several pools with different sizes and durations. Just make sure you can meet all period contributions.",
              },
              {
                question: "What happens if someone doesn't contribute?",
                answer:
                  "If a member misses a period contribution, the SancaPool contract can liquidate part of their collateral to cover that period. This ensures the pot is fully funded before the draw runs, without relying on manual admin intervention.",
              },
              {
                question: "How are payouts scheduled?",
                answer:
                  "Each cycle has one payout. Once all members have contributed or been liquidated, the pool settles the cycle and uses the pre-shuffled winner order derived from Drand randomness at pool start to decide who receives the USDC pot plus a share of the yield.",
              },
              {
                question: "What does the keeper do?",
                answer:
                  "The keeper is an off-chain service that polls all factory pools. When a cycle period ends, it fetches the latest drand beacon and submits settle_cycle so winners receive the pot plus a DeFindex yield bonus.",
              },
              {
                question: "Is my money secure?",
                answer:
                  "Funds are held directly by Soroban smart contracts (SancaFactory, SancaPool) on Stellar. All logic for joining, contributing, drawing winners, liquidating, and withdrawing is encoded on-chain and tested in Rust. There is no custodial backend—your wallet interacts with contracts directly.",
              },
              {
                question: "What fees does Sanca charge?",
                answer:
                  "Sanca takes a 10% platform fee on the yield bonus paid to cycle winners (on-chain via platform_fee_bps). Cycle pot principal is untouched. Network fees on testnet are often covered by the relayer.",
              },
              {
                question: "Can I leave a circle?",
                answer:
                  "Once you join a Sanca pool and the pool becomes full/active, you are locked in until all cycles complete. There is no early exit function in the smart contracts; your collateral can only be withdrawn at the end, minus any amounts that were liquidated to cover missed contributions.",
              },
            ].map((faq, idx) => (
              <details
                key={idx}
                className="group bg-background border border-border rounded-lg transition-colors hover:border-accent/50"
              >
                <summary className="flex cursor-pointer items-center justify-between p-6 font-semibold text-foreground select-none">
                  <span>{faq.question}</span>
                  <span className="transition-transform group-open:rotate-180">
                    {/* <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg> */}
                    <ChevronDown className="size-5" />
                  </span>
                </summary>
                <div className="p-6 text-muted-foreground text-sm border-t border-border">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold text-foreground">
              Ready to Start?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Create a community savings circle or join an existing one and let Sanca
              coordinate productive capital on Stellar.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <ActionButton size="lg" className="gap-2">
              Create a Circle
              <ArrowRight className="w-4 h-4" />
            </ActionButton>
            <ActionButton size="lg" variant="outline">
              Browse Circles
            </ActionButton>
          </div>

          {/* <p className="text-sm text-muted-foreground">
            Try as a demo user first to explore • No signup required to browse
          </p> */}
        </div>
      </section>
    </div>
  );
}