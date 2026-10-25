import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_VIDEO_TYPES,
  formatBytes,
  formatDuration,
  MAX_VIDEO_SIZE,
  validateVideoFile,
  videoForCamera,
  videoResolution,
} from './videosModel'
import type { VideoItem } from './videosModel'

describe('videosModel', () => {
  describe('validateVideoFile', () => {
    it('accepts known video types under the size limit', () => {
      for (const type of ACCEPTED_VIDEO_TYPES) {
        const file = new File(['x'], 'clip.mp4', { type })
        expect(validateVideoFile(file)).toEqual({ ok: true })
      }
    })

    it('accepts any video/* type', () => {
      const file = new File(['x'], 'clip.avi', { type: 'video/avi' })
      expect(validateVideoFile(file)).toEqual({ ok: true })
    })

    it('rejects non-video files', () => {
      const file = new File(['x'], 'clip.txt', { type: 'text/plain' })
      expect(validateVideoFile(file)).toEqual({
        ok: false,
        reason: 'El archivo no parece ser un video.',
      })
    })

    it('rejects empty videos', () => {
      const file = new File([], 'empty.mp4', { type: 'video/mp4' })
      expect(validateVideoFile(file)).toEqual({ ok: false, reason: 'El video está vacío.' })
    })

    it('rejects videos larger than 1 GB', () => {
      const file = new File(['x'], 'huge.mp4', { type: 'video/mp4' })
      Object.defineProperty(file, 'size', { value: MAX_VIDEO_SIZE + 1 })
      expect(validateVideoFile(file)).toEqual({
        ok: false,
        reason: 'El video pesa más de 1 GB.',
      })
    })
  })

  describe('formatBytes', () => {
    it('formats bytes compactly', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(512)).toBe('512 B')
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1_500_000).replace(/,/g, '.')).toBe('1.4 MB')
      expect(formatBytes(1_073_741_824)).toBe('1 GB')
    })
  })

  describe('formatDuration', () => {
    it('formats short durations as m:ss', () => {
      expect(formatDuration(0)).toBe('0:00')
      expect(formatDuration(65)).toBe('1:05')
      expect(formatDuration(3599)).toBe('59:59')
    })

    it('formats long durations as h:mm:ss', () => {
      expect(formatDuration(3661)).toBe('1:01:01')
      expect(formatDuration(3723)).toBe('1:02:03')
    })

    it('handles invalid durations', () => {
      expect(formatDuration(NaN)).toBe('0:00')
      expect(formatDuration(-10)).toBe('0:00')
    })
  })

  describe('videoResolution', () => {
    it('returns null when dimensions are missing', () => {
      expect(videoResolution(null, 1080)).toBeNull()
      expect(videoResolution(1920, null)).toBeNull()
    })

    it('returns the dimension pair when available', () => {
      expect(videoResolution(1920, 1080)).toBe('1920×1080')
    })
  })

  describe('videoForCamera', () => {
    const item = (id: string, cameraId: string | null, addedAt: string, status: VideoItem['status'] = 'ready'): VideoItem => ({
      id, fileName: `${id}.mp4`, size: 1, type: 'video/mp4', url: `blob:${id}`,
      duration: 10, width: 1280, height: 720, thumbnail: null,
      cameraId, addedAt: new Date(addedAt), status,
    })

    it('returns null when no video is assigned to the camera', () => {
      expect(videoForCamera([], 'cam-1')).toBeNull()
      expect(videoForCamera([item('a', 'cam-2', '2026-01-01T10:00:00Z'), item('b', null, '2026-01-01T11:00:00Z')], 'cam-1')).toBeNull()
    })

    it('returns the most recently added ready video for the camera', () => {
      const videos = [
        item('old', 'cam-1', '2026-01-01T10:00:00Z'),
        item('new', 'cam-1', '2026-01-01T12:00:00Z'),
        item('mid', 'cam-1', '2026-01-01T11:00:00Z'),
      ]
      expect(videoForCamera(videos, 'cam-1')?.id).toBe('new')
    })

    it('ignores videos that are still reading or failed', () => {
      const videos = [
        item('ready', 'cam-1', '2026-01-01T10:00:00Z'),
        item('reading', 'cam-1', '2026-01-01T11:00:00Z', 'reading'),
        item('error', 'cam-1', '2026-01-01T12:00:00Z', 'error'),
      ]
      expect(videoForCamera(videos, 'cam-1')?.id).toBe('ready')
      expect(videoForCamera(videos.slice(1), 'cam-1')).toBeNull()
    })
  })
})