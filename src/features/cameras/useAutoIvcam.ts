import { useEffect } from 'react'
import { aiServiceUrl, dataMode } from '../../api/config'
import { addCamera, connectionFor, getFarmPc, getServiceIvcam, listSavedCameras, saveCamera } from '../../services'

const TRY_EVERY_MS = 20_000

/**
 * When the farm's PC shows a phone through iVCam, it becomes one of this account's cameras without anyone typing a
 * thing. Once added, the PC remembers it and opens it again each time it starts, so this only acts the first time.
 */
export function useAutoIvcam() {
  useEffect(() => {
    if (dataMode === 'mock') return
    let finished = false
    let running = false

    const attempt = async () => {
      if (finished || running) return
      running = true
      try {
        // The account's linked PC; otherwise a service set up for this page, as when everything runs on one PC.
        const pc = (await getFarmPc()).data || aiServiceUrl
        if (!pc) return
        const index = await getServiceIvcam(pc)
        if (!index) return
        const saved = (await listSavedCameras()).data
        if (!saved.some(camera => camera.source === index)) {
          const camera = await saveCamera('iVCam', index)
          await addCamera(pc, { ...connectionFor(index), cameraId: camera.id })
        }
        finished = true
      } catch {
        // The PC may be starting, or this person may not be the owner: nothing to tell, it is tried again later.
      } finally {
        running = false
      }
    }

    void attempt()
    const timer = setInterval(() => void attempt(), TRY_EVERY_MS)
    return () => {
      finished = true
      clearInterval(timer)
    }
  }, [])
}
