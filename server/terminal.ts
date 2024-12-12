import * as pty from "node-pty"
import { WebSocket } from "ws"
import * as os from "os"

interface TerminalSession {
  pid: number
  ws: WebSocket
  pty: pty.IPty
}

const sessions = new Map<WebSocket, TerminalSession>()

export function handleTerminal(ws: WebSocket) {
  const shell = os.platform() === "win32" ? "powershell.exe" : "bash"
  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env as { [key: string]: string },
  })

  const session: TerminalSession = {
    pid: ptyProcess.pid,
    ws,
    pty: ptyProcess,
  }

  sessions.set(ws, session)

  ptyProcess.onData((data) => {
    try {
      ws.send(data)
    } catch (ex) {
      // Client probably closed
    }
  })

  ws.on("message", (data) => {
    try {
      const message = data.toString()
      if (message.startsWith("{")) {
        const parsed = JSON.parse(message)
        if (parsed.type === "resize") {
          ptyProcess.resize(parsed.cols, parsed.rows)
        }
      } else {
        ptyProcess.write(message)
      }
    } catch (ex) {
      console.error("Error handling terminal message:", ex)
    }
  })

  ws.on("close", () => {
    const session = sessions.get(ws)
    if (session) {
      session.pty.kill()
      sessions.delete(ws)
    }
  })
}
