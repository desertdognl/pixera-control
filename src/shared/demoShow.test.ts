import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DemoShow } from './demoShow'

describe('DemoShow', () => {
  it('fills timelines and cues on connect', () => {
    const show = new DemoShow()
    const state = show.snapshot()
    assert.equal(state.timelines.length, 3)
    assert.ok(state.timelines[0].cues.length >= 3)
    assert.equal(state.projectName, 'Demo Show')
  })

  it('jumps to a named cue on GO', () => {
    const show = new DemoShow()
    const first = show.snapshot().timelines[0]
    const cue = first.cues[2]
    const next = show.command({ type: 'go', timelineId: first.id, cueId: cue.id })
    const timeline = next.timelines[0]
    assert.equal(timeline.currentCueId, cue.id)
    assert.equal(timeline.positionSeconds, cue.timeSeconds)
    assert.equal(timeline.transport, 'play')
  })
})
