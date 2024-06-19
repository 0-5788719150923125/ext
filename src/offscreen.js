// Manifest v3 will not allow us to create nested workers, so we must use an
// off-screen worker to proxy messages between popup.js and backend.js

import { eventHandler } from './common.js'

// Create the web worker
const inferenceWorker = new Worker('worker.js', { type: 'module' })

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(message.action)
    if (message.action !== 'createWorker') return
    inferenceWorker.postMessage(message.data)
})

console.log('doing offscreen things')

inferenceWorker.onmessage = async (event) => {
    console.log(event)
    eventHandler(event)
}
