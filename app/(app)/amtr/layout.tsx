'use client'

import { AmtrModuleBar } from '@/components/amtr/module-bar'

// Wraps every /amtr route so the Help / Training References / Admin actions stay
// reachable from any page in the module.
export default function AmtrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AmtrModuleBar />
      {children}
    </>
  )
}
