import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "GatherWell | Event Management",
  description: "Event guest registration, seating, meals and print reports",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
