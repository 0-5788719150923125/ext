// Manifest v3 will not allow us to create nested workers, so we must use an
// off-screen worker to proxy messages between popup.js and backend.js
// https://groups.google.com/a/chromium.org/g/chromium-extensions/c/23pCzk69Ueo/m/z9GH0J7WBQAJ

import { eventHandler } from './common.js'

// Create the web worker
const inferenceWorker = new Worker(chrome.runtime.getURL('worker.js'), {
    type: 'module'
})

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    try {
        if (message.action !== 'createWorker') return
        inferenceWorker.postMessage(message.data)
    } catch (error) {
        eventHandler({ data: error })
    }
})

inferenceWorker.onmessage = async (event) => {
    eventHandler(event)
}
