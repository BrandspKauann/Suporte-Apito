// Map managed storage credentials to Vikunja's existing configuration.
// Do not log database URLs, passwords or storage keys.
export function runtimeConfig(input) {
  const env = {...input}
  const required = key => {
    if (!env[key]) throw new Error(`Configure ${key} nas variáveis de ambiente da Vercel.`)
    return env[key]
  }
  const port = env.PORT || '80'
  if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) throw new Error('PORT inválida.')
  env.PORT = port
  env.VIKUNJA_SERVICE_INTERFACE = `:${port}`
  env.VIKUNJA_SERVICE_ROOTPATH = '/tmp/apito'
  env.VIKUNJA_DATABASE_TYPE = 'postgres'
  env.VIKUNJA_DATABASE_SCHEMA ||= 'public'

  const connection = env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || env.POSTGRES_URL
  if (connection) {
    let url
    try { url = new URL(connection) } catch { throw new Error('A URL do PostgreSQL é inválida.') }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      throw new Error('A URL do PostgreSQL é inválida.')
    }
    try {
      env.VIKUNJA_DATABASE_HOST = `${url.hostname}:${url.port || '5432'}`
      env.VIKUNJA_DATABASE_USER = decodeURIComponent(url.username)
      env.VIKUNJA_DATABASE_PASSWORD = decodeURIComponent(url.password)
      env.VIKUNJA_DATABASE_DATABASE = decodeURIComponent(url.pathname.slice(1))
    } catch { throw new Error('A URL do PostgreSQL contém caracteres inválidos.') }
    env.VIKUNJA_DATABASE_SSLMODE = url.searchParams.get('sslmode') || 'require'
  }
  for (const key of ['HOST', 'USER', 'PASSWORD', 'DATABASE']) required(`VIKUNJA_DATABASE_${key}`)
  if (env.VIKUNJA_DATABASE_SSLMODE === 'disable' && env.VERCEL === '1') {
    throw new Error('O PostgreSQL precisa de TLS na Vercel.')
  }
  env.VIKUNJA_DATABASE_SSLMODE ||= 'require'
  env.VIKUNJA_DATABASE_MAXOPENCONNECTIONS ||= '5'
  env.VIKUNJA_DATABASE_MAXIDLECONNECTIONS ||= '2'

  env.VIKUNJA_SERVICE_PUBLICURL ||= env.VERCEL_URL ? `https://${env.VERCEL_URL}/` : ''
  let publicUrl
  try { publicUrl = new URL(required('VIKUNJA_SERVICE_PUBLICURL')) } catch {
    throw new Error('Configure VIKUNJA_SERVICE_PUBLICURL com o endereço HTTPS da interface.')
  }
  if (publicUrl.protocol !== 'https:') throw new Error('A interface pública precisa usar HTTPS.')
  if (required('VIKUNJA_SERVICE_SECRET').length < 64) {
    throw new Error('VIKUNJA_SERVICE_SECRET precisa ter pelo menos 64 caracteres e ser fixa entre instâncias.')
  }
  required('APITO_SIGNUP_CODE_SHA256')
  if (!/^[a-fA-F0-9]{64}$/.test(env.APITO_SIGNUP_CODE_SHA256)) throw new Error('Configure APITO_SIGNUP_CODE_SHA256 com o hash SHA-256 do código de proteção.')
  env.APITO_SIGNUP_ENABLED = 'true'
  env.APITO_SUPPORT_USER_ID ||= '1'
  env.VIKUNJA_SERVICE_ENABLEREGISTRATION = 'true'
  env.VIKUNJA_CORS_ENABLE = 'false' // Browser and API share the Vercel domain.
  env.VIKUNJA_FILES_TYPE = 's3' // Never put persistent attachments in /tmp.
  env.VIKUNJA_FILES_BASEPATH ||= 'apito'
  for (const key of ['ENDPOINT', 'BUCKET', 'REGION', 'ACCESSKEY', 'SECRETKEY']) required(`VIKUNJA_FILES_S3_${key}`)
  let endpoint
  try { endpoint = new URL(env.VIKUNJA_FILES_S3_ENDPOINT) } catch { throw new Error('Endpoint S3 inválido.') }
  if (endpoint.protocol !== 'https:' && env.VERCEL === '1') throw new Error('O armazenamento S3 precisa usar HTTPS.')
  env.VIKUNJA_FILES_S3_USEPATHSTYLE ||= 'true'
  env.VIKUNJA_LOG_STANDARD = 'stdout'
  env.VIKUNJA_LOG_HTTP = 'stdout'
  return env
}
