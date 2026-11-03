import { describe, expect, it } from 'vitest'
import { connectionFor, ipCameraSource, phoneLink } from './savedCameraService'

describe('connectionFor', () => {
  it('opens a saved address as it is when there is no password', () => {
    expect(connectionFor('192.168.1.20:8080')).toEqual({ kind: 'url', url: '192.168.1.20:8080' })
    expect(connectionFor('rtsp://192.168.1.30', { username: '', password: '' })).toEqual({ kind: 'url', url: 'rtsp://192.168.1.30' })
  })

  it('adds the typed login to an IP camera, keeping its port and route', () => {
    expect(connectionFor('rtsp://192.168.1.30:8554/Streaming/Channels/102?x=1', { username: 'admin', password: 'clave' })).toEqual({
      kind: 'ip', host: '192.168.1.30', username: 'admin', password: 'clave', port: 8554, path: '/Streaming/Channels/102?x=1',
    })
  })

  it('does not attach a login to anything but RTSP', () => {
    expect(connectionFor('1', { username: 'a', password: 'b' })).toEqual({ kind: 'url', url: '1' })
  })
})

describe('ipCameraSource', () => {
  it('builds the address without any password', () => {
    expect(ipCameraSource(' 192.168.1.30 ')).toBe('rtsp://192.168.1.30')
    expect(ipCameraSource('192.168.1.30', 'cam/1')).toBe('rtsp://192.168.1.30/cam/1')
    expect(ipCameraSource('192.168.1.30', '/cam/1')).toBe('rtsp://192.168.1.30/cam/1')
  })
})

describe('phoneLink', () => {
  const page = (hostname: string) => ({ protocol: 'http:', hostname, port: '5173' })

  it('uses the address the page was opened on', () => {
    expect(phoneLink('abc', page('192.168.1.5'), null)).toBe('http://192.168.1.5:5173/conectar-celular?code=abc')
  })

  it('swaps localhost, which a phone cannot open, for this PC on the network', () => {
    expect(phoneLink('abc', page('localhost'), '192.168.1.5')).toBe('http://192.168.1.5:5173/conectar-celular?code=abc')
  })

  it('gives no link when no phone could open it', () => {
    expect(phoneLink('abc', page('localhost'), null)).toBeNull()
  })
})