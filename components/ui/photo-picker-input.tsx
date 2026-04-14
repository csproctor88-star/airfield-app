'use client'

import { useRef } from 'react'
import { PhotoPickerButton } from './photo-picker-button'

type Props = {
  onFiles: (files: FileList) => void
  disabled?: boolean
  variant?: 'full' | 'compact'
  label?: string
  /** Allow selecting multiple files from the library (capture is always single). */
  multiple?: boolean
}

/**
 * Combined Upload / Capture photo input. Renders a single button that opens a
 * small popover offering "Take Photo" (camera) or "Upload from Library"
 * (gallery / files). Handles the two hidden file inputs internally so call
 * sites only wire `onFiles`.
 */
export function PhotoPickerInput({ onFiles, disabled, variant = 'full', label, multiple = true }: Props) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<HTMLInputElement>(null)

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.length) onFiles(files)
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handle}
        style={{ display: 'none' }}
      />
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handle}
        style={{ display: 'none' }}
      />
      <PhotoPickerButton
        onUpload={() => uploadRef.current?.click()}
        onCapture={() => captureRef.current?.click()}
        disabled={disabled}
        variant={variant}
        label={label}
      />
    </>
  )
}
