import { beforeEach, describe, expect, it } from 'vitest'
import { claimAccountData, forgetAccountData } from './accountStorage'
import { safeStorage } from './safeStorage'

const KEY = 'smartcattle.videos.analyses'

describe('account data in this browser', () => {
  beforeEach(() => forgetAccountData())

  it('removes what another account left when someone signs in', () => {
    claimAccountData('1')
    safeStorage.setJson(KEY, ['of one'])
    claimAccountData('2')
    expect(safeStorage.getJson(KEY)).toBeNull()
  })

  it('keeps what the same account left', () => {
    claimAccountData('1')
    safeStorage.setJson(KEY, ['of one'])
    claimAccountData('1')
    expect(safeStorage.getJson(KEY)).toEqual(['of one'])
  })

  it('removes it on signing out', () => {
    claimAccountData('1')
    safeStorage.setJson(KEY, ['of one'])
    forgetAccountData()
    expect(safeStorage.getJson(KEY)).toBeNull()
  })
})