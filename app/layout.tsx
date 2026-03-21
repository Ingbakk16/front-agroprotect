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

export const metadata: Metadata = {
  title: 'AgroProtect | Precision Sentinel Dashboard',
  description:
    'Precision agricultural monitoring for Argentina. Earth observation inputs include data from NASA public APIs, combined with risk analytics and AI.',
  generator: 'v0.app',
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
