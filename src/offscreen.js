// Manifest v3 will not allow us to create nested workers, so we must use an
// off-screen worker to proxy messages between popup.js and backend.js

let foregroundPort = null

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'foreground') {
        foregroundPort = port
        foregroundPort.onDisconnect.addListener(() => {
            foregroundPort = null
        })
    }
})

function sendToForeground(type, data) {
    if (foregroundPort) {
        foregroundPort.postMessage({ type, data })
    } else {
        try {
            chrome.runtime.sendMessage({ type, data })
        } catch (err) {
            console.err('failed to send to front end')
        }
    }
}

// Create the web worker
const inferenceWorker = new Worker('worker.js', { type: 'module' })

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'createWorker') {
        // Send a message to the worker
        inferenceWorker.postMessage(message.data)
    }
})

// // Listen for messages from the worker
// inferenceWorker.onmessage = (event) => {
//     // Send the message back to the background script
//     chrome.runtime.sendMessage(event.data)
// }

inferenceWorker.onmessage = async (event) => {
    if (event.data.action === 'classification') {
        sendToForeground('toTopic', event.data.answer)
    } else if (event.data.status === 'partial') {
        sendToForeground('floatRight')
        sendToForeground('toInputField', event.data.input)
    } else if (event.data.status === 'complete') {
        sendToForeground('toOutputField', event.data.output)
        // gun.send(event.data.output)
    } else if (event.data.action === 'cleanup') {
        sendToForeground('toInputField', '')
        sendToForeground('floatLeft')
    } else if (
        !['progress', 'ready', 'done', 'download', 'initiate'].includes(
            event.data.status
        )
    ) {
        console.log(event)
    } else {
        sendToForeground('toInputField', '')
        sendToForeground('floatLeft')
    }
}
