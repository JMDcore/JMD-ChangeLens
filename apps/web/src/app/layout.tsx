import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth-provider";

import "./globals.css";
import "./product-theme.css";

export const metadata: Metadata = {
  title: { default: "ChangeLens", template: "%s · ChangeLens" },
  description: "Safe, observable web data extraction and change monitoring.",
  applicationName: "ChangeLens",
  authors: [{ name: "José Miguel Díaz", url: "https://github.com/JMDcore" }],
  icons: { icon: "/brand/mark.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f3f7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
