import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { cameraProblem } from './cameraSetupService'

const answer = (detail: string) => {
  const error = Object.create(ApiError.prototype) as ApiError
  return Object.assign(error, { status: 422, detail })
}

describe('a camera that does not answer', () => {
  it('says when the address is on another network', () => {
    expect(cameraProblem(answer('No answer from 192.168.1.30:554 (this PC is 192.168.100.62)'))).toMatch(/no está en tu red.*192\.168\.100\.x/)
  })

  it('says when it is on this network and silent', () => {
    expect(cameraProblem(answer('No answer from 192.168.100.30:554 (this PC is 192.168.100.62)'))).toMatch(/192\.168\.100\.30 no responde/)
  })
})
