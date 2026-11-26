import { spawn } from 'node:child_process'
import path from 'node:path'

const PORT = 4173
const BASE = `http://127.0.0.1:${PORT}`
const npx = 'npx'

async function ready() {
  try {
    const res = await fetch(BASE)
    return res.status < 500
  } catch {
    return false
  }
}

async function waitForServer(seconds = 40) {
  const until = Date.now() + seconds * 1000
  while (Date.now() < until) {
    if (await ready()) return true
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

function stop(server) {
  if (!server) return
  try {
    if (process.platform === 'win32') {
      process.kill(server.pid)
    } else {
      process.kill(-server.pid, 'SIGTERM')
    }
  } catch {
    // 进程可能已自行退出
  }
}

let server = null
if (!(await ready())) {
  const viteBin = path.resolve('node_modules/vite/bin/vite.js')
  server = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  })
  if (!(await waitForServer())) {
    stop(server)
    console.error(`预览服务未能在 ${BASE} 启动`)
    process.exit(1)
  }
}

const test = spawn(npx, ['playwright', 'test'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, E2E_EXTERNAL_SERVER: '1' },
})

const shutdown = () => {
  stop(server)
  process.exit(130)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

test.on('exit', (code) => {
  stop(server)
  process.exit(code ?? 1)
})
