import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

process.env.NODE_ENV = 'test'
process.env.OPENAI_API_KEY = ''

const { default: app } = await import('./index.js')
const server = createServer(app)
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, resolve)
})
const address = server.address()
const baseUrl = 'http://127.0.0.1:' + address.port

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
})

test('health endpoint reports API configuration without exposing secrets', async () => {
  const response = await fetch(baseUrl + '/api/health')
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.status, 'ok')
  assert.equal(body.aiConfigured, false)
  assert.equal('apiKey' in body, false)
})

test('ask endpoint validates an empty question', async () => {
  const response = await fetch(baseUrl + '/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: '   ', language: 'en' }),
  })
  const body = await response.json()
  assert.equal(response.status, 400)
  assert.equal(body.error, 'Please enter a question.')
})

test('ask endpoint gives a safe configuration error when no key is set', async () => {
  const response = await fetch(baseUrl + '/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Explain fractions', language: 'en' }),
  })
  const body = await response.json()
  assert.equal(response.status, 503)
  assert.equal(body.code, 'AI_NOT_CONFIGURED')
  assert.match(body.error, /OPENAI_API_KEY/)
})
