import { doInference } from './inference.js'

self.onmessage = async function (event) {
    if (event.data.action !== 'inference') return
    await doInference(event.data)
}

self.onerror = async function (event) {
    self.postMessage({ status: 'error', data: event.data })
}
