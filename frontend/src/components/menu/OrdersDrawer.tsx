"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionOrders } from "@/hooks/useOrders";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Receipt, Clock, ChevronRight, UtensilsCrossed } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function OrdersDrawer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderIds, setOrderIds] = useState<string[]>([]);

  useEffect(() => {
    const loadOrders = () => {
      const stored = localStorage.getItem("dc_session_orders");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setOrderIds(parsed);
          } else {
            setOrderIds([]); // Fix: Ensure it clears if array is empty
          }
        } catch (e) {
          console.error("Failed to parse session orders", e);
          setOrderIds([]);
        }
      } else {
        setOrderIds([]); // Fix: Ensure it clears if storage is wiped
      }
    };

    loadOrders(); // 1. Run immediately on load

    // 2. Listen for real-time updates from the Cart and Store
    window.addEventListener("storage", loadOrders); // Cross-tab sync
    window.addEventListener("dc_orders_updated", loadOrders); // Same-tab sync

    return () => {
      window.removeEventListener("storage", loadOrders);
      window.removeEventListener("dc_orders_updated", loadOrders);
    };
  }, []); // Fix: Empty dependency array means it stays synced forever

  const { data: orders, isLoading } = useSessionOrders(orderIds);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "received": return "bg-blue-100 text-blue-700";
      case "preparing": return "bg-orange-100 text-orange-700";
      case "ready": return "bg-green-100 text-green-700";
      case "served": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const pendingOrders = orders?.filter(o => o.paymentStatus === "pending") || [];
  const hasPendingBill = pendingOrders.length > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-8 w-8 rounded-full border-orange-200 text-orange-600 hover:bg-orange-50">
          <Receipt className="h-4 w-4" />
          {orderIds.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
              {orderIds.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="flex w-full flex-col px-0 sm:max-w-md">
        <SheetHeader className="px-6 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-orange-500" />
            My Orders
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 p-6">
          {orderIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-12 text-center text-muted-foreground">
              <UtensilsCrossed className="mb-3 h-10 w-10 opacity-20" />
              <p>You haven't placed any orders yet.</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : orders?.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-12 text-center text-muted-foreground">
              <p>Could not load session orders.</p>
            </div>
          ) : (
            <div className="space-y-4 pb-20">
              {orders?.map((order) => (
                <div key={order.id} 
                     onClick={() => {
                        setOpen(false);
                        router.push(`/order-status?id=${order.id}`);
                     }}
                     className="group cursor-pointer rounded-xl border bg-card p-4 transition-all hover:bg-muted/50 hover:shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">#{order.orderNumber}</span>
                      <Badge variant="secondary" className={cn("text-[10px] uppercase font-bold tracking-wider", getStatusColor(order.kitchenStatus))}>
                        {order.kitchenStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="mr-1 h-3 w-3" />
                      {format(new Date(order.createdAt), "h:mm a")}
                    </div>
                  </div>
                  
                  <div className="pt-3 space-y-1.5">
                    {order.items.slice(0, 2).map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs sm:text-sm">
                        <span className="truncate pr-2">
                          <span className="font-medium text-muted-foreground mr-1.5">{item.quantity}×</span>
                          {item.name}
                        </span>
                        <span className="font-medium">₹{item.totalPrice}</span>
                      </div>
                    ))}
                    {order.items.length > 2 && (
                      <div className="text-xs text-muted-foreground pt-1">
                        + {order.items.length - 2} more items
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-dashed">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {order.paymentStatus === "pending" ? "Unpaid" : "Paid"}
                    </span>
                    <div className="flex items-center text-orange-500 text-sm font-semibold">
                      Track Status <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {hasPendingBill && (
          <div className="border-t p-4 pb-6 bg-background shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)]">
            <Button 
                onClick={() => {
                   setOpen(false);
                   router.push("/pay-bill");
                }}
                className="w-full text-base h-12 font-bold bg-orange-500 hover:bg-orange-600 text-white"
            >
              Pay Full Bill
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
