declare module '*.png' {
  const src: string
  export default src
}

import type { ControlApi } from '../../preload/index'

declare global {
  interface Window {
    control?: ControlApi
  }
}

export {}
