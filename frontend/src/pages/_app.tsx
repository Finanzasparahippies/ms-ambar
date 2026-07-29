import "../styles/globals.css";
import Layout from "../components/Layout";
import type { AppProps, NextWebVitalsMetric } from "next/app";
import { Inter } from "next/font/google";
import { reportWebVitalsToBackend } from "../lib/performance";
import PerformanceHUD from "../components/PerformanceHUD";
import { Toaster } from "react-hot-toast";
import { EventThemeContextProvider } from "../context/EventThemeContext";

const inter = Inter({ subsets: ["latin"] });

export function reportWebVitals(metric: NextWebVitalsMetric) {
  reportWebVitalsToBackend(metric);
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <EventThemeContextProvider>
      <div className={inter.className}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
        <PerformanceHUD />
        <Toaster position="top-right" />
      </div>
    </EventThemeContextProvider>
  );
}
