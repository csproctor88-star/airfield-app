/**
 * Airfield diagram storage — saves/retrieves diagram images per base.
 * Uses IndexedDB (STORE_USER_BLOBS) so it works in both demo and live mode.
 */

import { idbSet, idbGet, idbDelete, STORE_USER_BLOBS } from './idb'

const KEY_PREFIX = 'airfield-diagram-'

function key(baseId: string) {
  return `${KEY_PREFIX}${baseId}`
}

/** Convert a File to a data URL string */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Save an airfield diagram for a base */
export async function saveAirfieldDiagram(baseId: string, file: File): Promise<void> {
  const dataUrl = await fileToDataUrl(file)
  await idbSet(STORE_USER_BLOBS, key(baseId), dataUrl)
}

/** Get the diagram data URL for a base, or null if none saved */
export async function getAirfieldDiagram(baseId: string): Promise<string | null> {
  return idbGet<string>(STORE_USER_BLOBS, key(baseId))
}

/** Delete the diagram for a base */
export async function deleteAirfieldDiagram(baseId: string): Promise<void> {
  await idbDelete(STORE_USER_BLOBS, key(baseId))
}
