import { describe, expect, it } from 'vitest'
import { DEVICE_SOURCE, deviceCameraProblem, findIvcam, frameSize, isDeviceCamera, onlyInsideItsNetwork } from './deviceCamera'

const failure = (name: string) => Object.assign(new Error('x'), { name })

describe('addresses', () => {
  it('knows which ones only exist inside a network', () => {
    for (const address of ['192.168.100.35', 'rtsp://192.168.1.30/live', '10.0.0.5:8080', '172.16.0.9', 'http://localhost:8080', 'camara.local', '0', ' 1 ']) {
      expect(onlyInsideItsNetwork(address)).toBe(true)
    }
    for (const address of ['8.8.8.8', 'rtsp://181.50.2.3:554/live', 'https://camara.example.com/video', '172.32.0.1']) {
      expect(onlyInsideItsNetwork(address)).toBe(false)
    }
  })
})

describe('a phone as a camera', () => {
  it('is told apart from cameras with an address', () => {
    expect(isDeviceCamera(DEVICE_SOURCE)).toBe(true)
    expect(isDeviceCamera('rtsp://192.168.1.30')).toBe(false)
  })

  it('sends a smaller picture without changing its shape, and never enlarges one', () => {
    expect(frameSize(1920, 1080)).toEqual({ width: 960, height: 540 })
    expect(frameSize(640, 480)).toEqual({ width: 640, height: 480 })
  })

  it('finds the iVCam webcam among the PC cameras, and only a camera', () => {
    const camera = (label: string, deviceId: string, kind: MediaDeviceKind = 'videoinput') => ({ deviceId, kind, label })
    expect(findIvcam([camera('Integrated Webcam (0bda:5521)', 'built-in'), camera('e2eSoft iVCam', 'phone')])).toBe('phone')
    expect(findIvcam([camera('iVCam Microphone', 'mic', 'audioinput'), camera('Integrated Webcam', 'built-in')])).toBeNull()
    // Before the camera permission is granted, the browser hides every name.
    expect(findIvcam([camera('', 'a'), camera('', 'b')])).toBeNull()
  })

  it('explains each way the camera can fail to open', () => {
    expect(deviceCameraProblem(failure('NotAllowedError'))).toMatch(/permiso/)
    expect(deviceCameraProblem(failure('NotFoundError'))).toMatch(/no tiene una cámara/)
    expect(deviceCameraProblem(failure('NotReadableError'))).toMatch(/Otra aplicación/)
    expect(deviceCameraProblem(failure('TypeError'))).toMatch(/https/)
    expect(deviceCameraProblem('algo raro')).toMatch(/No se pudo abrir/)
  })
})
