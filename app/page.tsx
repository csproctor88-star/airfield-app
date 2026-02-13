import { Plane } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-900 to-sky-400">
          <Plane className="h-8 w-8 text-white" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-slate-100">
          AIRFIELD OPS
        </h1>
        <p className="text-sm text-slate-400">
          Selfridge ANGB &bull; KMTC &bull; 127th Wing
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Phase 1 MVP — Project Setup Complete
        </p>
      </div>
    </div>
  )
}
