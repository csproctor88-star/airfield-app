'use client'

import { useRef } from 'react'
import { PhotoPickerButton } from './photo-picker-button'

type Props = {
  onFiles: (files: FileList) => void
  disabled?: boolean
  variant?: 'full' | 'compact'
  label?: string
  /** Allow selecting multiple files from the library. */
  multiple?: boolean
}

/**
 * Combined photo input. Renders an "Add Photo" button that opens the OS's
 * native file picker — on iOS that's the Photo Library / Take Photo /
 * Choose Files action sheet; on Android it's the equivalent chooser.
 * Owns one hidden `<input type="file" accept="image/*">` so call sites
 * only wire `onFiles`.
 */
export function PhotoPickerInput({ onFiles, disabled, variant = 'full', label, multiple = true }: Props) {
  const uploadRef = useRef<HTMLInputElement>(null)

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
      <PhotoPickerButton
        onUpload={() => uploadRef.current?.click()}
        disabled={disabled}
        variant={variant}
        label={label}
      />
    </>
  )
}
