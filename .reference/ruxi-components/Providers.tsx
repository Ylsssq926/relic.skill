'use client'
import { AuthProvider } from '@/lib/auth-context'
import { MotionProvider } from '@/components/MotionProvider'
import Toast from '@/components/Toast'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MotionProvider>
        {children}
        <Toast />
      </MotionProvider>
    </AuthProvider>
  )
}
