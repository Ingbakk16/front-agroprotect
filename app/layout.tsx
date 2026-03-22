import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { DeferredAnalytics } from '@/components/deferred-analytics'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
})

const siteUrlRaw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
const metadataBaseUrl =
  siteUrlRaw && siteUrlRaw.length > 0
    ? siteUrlRaw.replace(/\/$/, '')
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
      : 'http://localhost:3000'

const defaultTitle = 'AgroProtect | Precision Sentinel Dashboard'
const defaultDescription =
  'Precision agricultural monitoring for Argentina. Earth observation inputs include data from NASA public APIs, combined with risk analytics and AI.'

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: defaultTitle,
  description: defaultDescription,
  generator: 'v0.app',
  openGraph: {
    title: `${defaultTitle}\u200b`,
    description: defaultDescription,
    siteName: 'AgroProtect',
    locale: 'es_AR',
    type: 'website',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 600,
        type: 'image/png',
        alt: 'AgroProtect — monitoreo agrícola de precisión',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${defaultTitle}\u200b`,
    description: defaultDescription,
    images: ['/api/og'],
  },
}

export const viewport: Viewport = {
  themeColor: '#0f131c',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${playfairDisplay.variable} font-sans antialiased`}
      >
        {children}
        <DeferredAnalytics />
      </body>
    </html>
  )
}
