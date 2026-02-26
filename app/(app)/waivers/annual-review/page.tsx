'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AnnualReviewRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace(`/waivers/annual-review/${new Date().getFullYear()}`)
  }, [router])
  return null
}
