"use client";
// src/components/admin/StatsCards.tsx

import { TrendingUp, TrendingDown, ShoppingBag, Users, IndianRupee, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RevenueStats } from "@/types";
import { cn } from "@/lib/utils";

interface StatsCardsProps {
  stats?: RevenueStats;
  isLoading?: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  const cards = [
    {
      label: "Today's Revenue",
      value: stats ? `₹${stats.todayRevenue.toLocaleString("en-IN")}` : "—",
      icon: IndianRupee,
      iconBg: "bg-orange-100 dark:bg-orange-950",
      iconColor: "text-orange-600",
    },
    {
      label: "This Month",
      value: stats ? `₹${(stats.monthRevenue / 1000).toFixed(1)}k` : "—",
      sub: stats ? `${stats.growthPercent >= 0 ? "+" : ""}${stats.growthPercent.toFixed(1)}% vs last month` : undefined,
      positive: stats ? stats.growthPercent >= 0 : undefined,
      icon: TrendingUp,
      iconBg: "bg-green-100 dark:bg-green-950",
      iconColor: "text-green-600",
    },
    {
      label: "Total Orders",
      value: stats ? stats.totalOrders.toLocaleString() : "—",
      icon: ShoppingBag,
      iconBg: "bg-blue-100 dark:bg-blue-950",
      iconColor: "text-blue-600",
    },
    {
      label: "Avg. Order Value",
      value: stats ? `₹${stats.avgOrderValue.toFixed(0)}` : "—",
      icon: Percent,
      iconBg: "bg-purple-100 dark:bg-purple-950",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className={cn("inline-flex rounded-lg p-2", card.iconBg)}>
                    <Icon className={cn("h-4 w-4", card.iconColor)} />
                  </div>
                  <p className="text-xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  {card.sub && (
                    <div className={cn("flex items-center gap-1 text-xs font-medium",
                      card.positive ? "text-green-600" : "text-red-500")}>
                      {card.positive
                        ? <TrendingUp className="h-3 w-3" />
                        : <TrendingDown className="h-3 w-3" />}
                      {card.sub}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
