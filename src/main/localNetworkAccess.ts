import dgram from 'node:dgram'

/** macOS 15+: poke Local Network TCC so the app appears in Privacy settings and can prompt. */
export function requestLocalNetworkAccess(): void {
  if (process.platform !== 'darwin') return
  try {
    const socket = dgram.createSocket('udp4')
    socket.on('error', () => {
      try {
        socket.close()
      } catch {
        /* ignore */
      }
    })
    socket.bind(() => {
      try {
        socket.setBroadcast(true)
      } catch {
        /* ignore */
      }
      // mDNS multicast — enough for TCC to attribute Local Network to this bundle
      socket.send(Buffer.alloc(1), 5353, '224.0.0.251', () => {
        try {
          socket.close()
        } catch {
          /* ignore */
        }
      })
    })
  } catch {
    /* ignore */
  }
}
