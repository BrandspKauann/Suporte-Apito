import {spawn} from 'node:child_process'
import {mkdir} from 'node:fs/promises'
import {runtimeConfig} from './config.mjs'

try {
  const env = runtimeConfig(process.env)
  await mkdir(env.VIKUNJA_SERVICE_ROOTPATH, {recursive: true})
  const child = spawn('/usr/local/bin/vikunja', ['web'], {env, stdio: 'inherit'})
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => child.kill('SIGINT'))
  }
  child.on('error', () => { console.error('Não foi possível iniciar a API.'); process.exit(1) })
  child.on('exit', code => process.exit(code ?? 1))
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
