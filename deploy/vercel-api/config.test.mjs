import {test} from 'node:test'
import assert from 'node:assert/strict'
import {runtimeConfig} from './config.mjs'

const fixture = () => ({
  VERCEL: '1',
  APITO_SIGNUP_CODE_SHA256: 'a'.repeat(64),
  PORT: '9000',
  VERCEL_URL: 'apito.example.com',
  DATABASE_URL: 'postgresql://user:p%40ss%3Aword@db.example.com:6543/tasks?sslmode=verify-full',
  VIKUNJA_SERVICE_SECRET: 'x'.repeat(64),
  VIKUNJA_FILES_S3_ENDPOINT: 'https://storage.example.com/storage/v1/s3',
  VIKUNJA_FILES_S3_BUCKET: 'attachments',
  VIKUNJA_FILES_S3_REGION: 'us-east-1',
  VIKUNJA_FILES_S3_ACCESSKEY: 'example',
  VIKUNJA_FILES_S3_SECRETKEY: 'example-secret',
})

test('maps provider credentials, port and HTTPS without losing escaped passwords', () => {
  const config = runtimeConfig(fixture())
  assert.equal(config.VIKUNJA_DATABASE_PASSWORD, 'p@ss:word')
  assert.equal(config.VIKUNJA_DATABASE_HOST, 'db.example.com:6543')
  assert.equal(config.VIKUNJA_DATABASE_DATABASE, 'tasks')
  assert.equal(config.VIKUNJA_DATABASE_SCHEMA, 'public')
  assert.equal(config.VIKUNJA_DATABASE_SSLMODE, 'verify-full')
  assert.equal(config.VIKUNJA_SERVICE_INTERFACE, ':9000')
  assert.equal(config.VIKUNJA_SERVICE_PUBLICURL, 'https://apito.example.com/')
  assert.equal(config.VIKUNJA_FILES_TYPE, 's3')
  assert.equal(config.VIKUNJA_CORS_ENABLE, 'false')
  assert.equal(config.VIKUNJA_SERVICE_ENABLEREGISTRATION, 'true')
  assert.equal(config.APITO_SIGNUP_ENABLED, 'true')
  assert.equal(config.APITO_SUPPORT_USER_ID, '1')
})

test('uses the direct connection supplied by the Marketplace for migrations', () => {
  const input = fixture()
  input.POSTGRES_URL_NON_POOLING = 'postgres://direct:password@direct.example.com/db'
  assert.equal(runtimeConfig(input).VIKUNJA_DATABASE_HOST, 'direct.example.com:5432')
})

test('refuses temporary attachments, missing secrets, insecure production storage and invalid ports', () => {
  for (const key of ['VIKUNJA_FILES_S3_BUCKET', 'VIKUNJA_SERVICE_SECRET', 'APITO_SIGNUP_CODE_SHA256']) {
    const input = fixture()
    delete input[key]
    assert.throws(() => runtimeConfig(input), new RegExp(key))
  }
  for (const changes of [
    {PORT: 'invalid'},
    {DATABASE_URL: 'postgres://user:password@db.example.com/db?sslmode=disable'},
    {VIKUNJA_FILES_S3_ENDPOINT: 'http://storage.example.com'},
    {VIKUNJA_SERVICE_SECRET: 'short'},
  ]) assert.throws(() => runtimeConfig({...fixture(), ...changes}))
})

test('does not include a malformed database secret in error messages', () => {
  assert.throws(() => runtimeConfig({...fixture(), DATABASE_URL: 'secret-password-invalid'}), error => {
    assert.ok(!error.message.includes('secret-password'))
    return true
  })
})
