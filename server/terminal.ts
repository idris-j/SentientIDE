import * as pty from "node-pty"
import { WebSocket } from "ws"
import * as os from "os"
import { log } from "./vite"

interface TerminalSession {
  pid: number
  ws: WebSocket
  pty: pty.IPty
}

const sessions = new Map<WebSocket, TerminalSession>()

export function handleTerminal(ws: WebSocket) {
  try {
    const shell = os.platform() === "win32" ? "powershell.exe" : "bash"
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: { ...process.env, TERM: 'xterm-256color' } as { [key: string]: string },
    })

    const session: TerminalSession = {
      pid: ptyProcess.pid,
      ws,
      pty: ptyProcess,
    }

    sessions.set(ws, session)
    log("Terminal session created", "terminal")

    ptyProcess.onData((data) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      } catch (ex) {
        log(`Error sending terminal data: ${ex}`, "terminal")
      }
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      log(`Terminal process exited with code ${exitCode} and signal ${signal}`, "terminal")
      const session = sessions.get(ws)
      if (session) {
        sessions.delete(ws)
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
      }
    })

    ws.on("message", (data) => {
      try {
        const message = data.toString()
        if (message.startsWith("{")) {
          const parsed = JSON.parse(message)
          if (parsed.type === "resize") {
            ptyProcess.resize(parsed.cols, parsed.rows)
            log(`Terminal resized to ${parsed.cols}x${parsed.rows}`, "terminal")
          }
        } else {
          ptyProcess.write(message)
        }
      } catch (ex) {
        log(`Error handling terminal message: ${ex}`, "terminal")
      }
    })

    ws.on("error", (error) => {
      log(`WebSocket error: ${error}`, "terminal")
      const session = sessions.get(ws)
      if (session) {
        session.pty.kill()
        sessions.delete(ws)
      }
    })

    ws.on("close", () => {
      log("Terminal WebSocket closed", "terminal")
      const session = sessions.get(ws)
      if (session) {
        session.pty.kill()
        sessions.delete(ws)
      }
    })

    // Send initial greeting
    ptyProcess.write('echo "Terminal session started"\r')
  } catch (error) {
    log(`Failed to create terminal session: ${error}`, "terminal")
    if (ws.readyState === WebSocket.OPEN) {
      ws.close()
    }
  }
}
