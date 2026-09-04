import type { Metadata, Viewport } from "next";
import { Pinyon_Script } from "next/font/google";
import "./globals.css";
import "./chat.css";
import "./music.css";
import "./settings.css";
import "./theme.css";
import "./home.css";
import "./memory.css";
import "./typography.css";

const pinyonScript = Pinyon_Script({
  variable: "--font-pinyon-script",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Vesper — 私人生活角落",
  description: "天气、便笺、纪念日、提醒与音乐，在晚风般安静的空间里相遇。",
  manifest: "/manifest.webmanifest?v=10",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vesper",
  },
  icons: {
    icon: [
      {
        url: "/favicon-20260901-v1.png",
        sizes: "64x64",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon-20260901-v1.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${pinyonScript.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
