// Whether this person has gone past the Cameras page, by adding a camera or by choosing to go on without one. In memory,
// so it lasts this visit; signing in as someone else starts over.
let skipped = false

export const skipCameraSetup = () => { skipped = true }
export const resetCameraSetup = () => { skipped = false }
export const cameraSetupSkipped = () => skipped
