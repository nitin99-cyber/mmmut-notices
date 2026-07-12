import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MMMUT Notice Intelligence Platform",
  description:
    "The automated pipeline that scrapes, processes, and distributes MMMUT university notices using advanced OCR and Gemini Vision AI.",
  keywords: ["MMMUT", "notices", "university", "AI", "OCR", "pipeline"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {children}
      </body>
    </html>
  );
}
