import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEO Command Center – Windsor.ai",
  description: "Unified GSC + GA4 SEO Dashboard powered by Windsor.ai",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
