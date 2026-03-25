// src/app/page.tsx
import { redirect } from "next/navigation";

// Root redirects to menu — table ID comes from QR code URL param
export default function RootPage() {
  redirect("/menu");
}
