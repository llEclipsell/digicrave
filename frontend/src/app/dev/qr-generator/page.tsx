"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import api from "@/lib/axios";

export default function QRGeneratorPage() {
  const [restaurantId, setRestaurantId] = useState("099e3454-e48c-42d9-9098-d554e7d9ccd2");
  const [tableNumber, setTableNumber] = useState("1");
  const [qrData, setQrData] = useState<{ token: string; qr_url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError("");
      setQrData(null);
      // Calls backend using the global dev token because we are not logged in as staff
      // Note: This endpoint is protected by staff JWT, but get_current_staff falls back to
      // a dummy owner token in development!
      const res = await api.post("/api/v1/qr/generate", {
        restaurant_id: restaurantId,
        table_number: parseInt(tableNumber)
      });
      setQrData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (process.env.NODE_ENV !== "development") {
    return <div className="p-8 text-center text-red-500">Only available in development environment.</div>;
  }

  return (
    <div className="min-h-screen bg-muted/20 p-8 flex justify-center items-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Dev QR Token Generator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Restaurant ID</Label>
            <Input 
              value={restaurantId} 
              onChange={(e) => setRestaurantId(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label>Table Number</Label>
            <Input 
              type="number" 
              value={tableNumber} 
              onChange={(e) => setTableNumber(e.target.value)} 
            />
          </div>
          
          <Button 
            onClick={handleGenerate} 
            className="w-full"
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate QR Token"}
          </Button>

          {error && (
            <div className="p-3 bg-red-500/10 text-red-500 rounded-md text-sm">
              {error}
            </div>
          )}

          {qrData && (
            <div className="mt-6 flex flex-col items-center space-y-4 p-4 border rounded-lg bg-white">
              <QRCodeSVG 
                value={qrData.qr_url} 
                size={200}
                level="M"
              />
              <div className="text-center w-full">
                <Label className="text-muted-foreground text-xs mb-1 block">Full URL</Label>
                <div className="p-2 bg-muted text-xs break-all rounded border">
                  {qrData.qr_url}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(qrData.qr_url);
                    alert("Copied to clipboard!");
                  }}
                >
                  Copy URL
                </Button>
                <Button 
                  size="sm" 
                  className="mt-2 w-full"
                  onClick={() => window.open(qrData.qr_url, "_blank")}
                >
                  Open in New Tab
                </Button>
                <div className="mt-3 text-[10px] text-muted-foreground text-center">
                  This QR code expires in 24 hours.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
