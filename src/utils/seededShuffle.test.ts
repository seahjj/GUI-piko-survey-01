import { describe, expect, it } from 'vitest'
import { seededShuffle } from './seededShuffle'

describe('seededShuffle', () => {
  it('keeps the same order for the same respondent and changes another seed', () => {
    const items = ['judgement-a', 'judgement-b', 'judgement-c']
    expect(seededShuffle(items, 'respondent-1')).toEqual(seededShuffle(items, 'respondent-1'))
    expect(seededShuffle(items, 'respondent-1')).not.toEqual(seededShuffle(items, 'respondent-2'))
    expect(seededShuffle(items, 'respondent-1').sort()).toEqual(items.sort())
  })
})
