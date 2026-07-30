import "../styles/globals.css";
import Layout from "../components/Layout";
import type { AppProps, NextWebVitalsMetric } from "next/app";
import { Inter } from "next/font/google";
import Head from "next/head";
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
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
      </Head>
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

