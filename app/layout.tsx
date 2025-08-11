// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Foodie‑Zap",
  description: "Discover great eats",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
