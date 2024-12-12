import * as React from "react"
import { Terminal as XTerm } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import { WebLinksAddon } from "xterm-addon-web-links"
import "xterm/css/xterm.css"

interface TerminalProps {
  className?: string
}

export function Terminal({ className }: TerminalProps) {
  const terminalRef = React.useRef<HTMLDivElement>(null)
  const xtermRef = React.useRef<XTerm>()

  React.useEffect(() => {
    if (!terminalRef.current) return

    // Initialize xterm
    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "monospace",
      fontSize: 14,
      theme: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cursor: "var(--foreground)",
        selection: "var(--accent)",
      },
    })

    // Add addons
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)

    // Open terminal in the container
    term.open(terminalRef.current)
    fitAddon.fit()

    // Store the terminal instance
    xtermRef.current = term

    // Set up WebSocket connection for terminal
    const ws = new WebSocket(`ws://${window.location.host}/terminal`)
    
    ws.onopen = () => {
      term.write("\x1B[1;3;32mTerminal connected.\x1B[0m\r\n$ ")
    }

    ws.onmessage = (event) => {
      term.write(event.data)
    }

    term.onData((data) => {
      ws.send(data)
    })

    // Handle resize
    const handleResize = () => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "resize",
          cols: term.cols,
          rows: term.rows,
        }))
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      term.dispose()
      ws.close()
    }
  }, [])

  return (
    <div ref={terminalRef} className={className} />
  )
}
