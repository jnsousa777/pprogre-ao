import "./globals.css";

export const metadata = {
  title: "Progressão — Modo Academia",
  description: "Diário de treino com evolução por sessão e por exercício.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/static/icon-192.png", apple: "/static/icon-192.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090d17",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
