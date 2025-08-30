// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css' // <-- this is the ONLY way we pull in CSS here

export const metadata: Metadata = {
  title: 'Foodie-Zap',
  description: 'Find, compare, and track competitors',
}

import Navbar from '@/components/Navbar'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  )
}
