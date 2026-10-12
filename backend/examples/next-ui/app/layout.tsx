import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Text Integrity — Hybrid Evidence", description: "Private bilingual document analysis with calibrated abstention safeguards." };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
