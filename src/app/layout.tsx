import type { Metadata } from "next";
import "@/styles/Global.scss";
import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/footer/Footer";

export const metadata: Metadata = {
  title: "My Website",
  description: "Generated with Web Dev Wizard",
};

const isEcommerce = process.env.NEXT_PUBLIC_SITE_MODE === "ecommerce";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar isEcommerce={isEcommerce} />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
