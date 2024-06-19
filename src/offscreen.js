// Manifest v3 will not allow us to create nested workers, so we must use an
// off-screen worker to proxy messages between popup.js and backend.js

function sendToForeground(action, data) {
    chrome.runtime.sendMessage({ action, data })
}

// Create the web worker
const inferenceWorker = new Worker('worker.js', { type: 'module' })

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'createWorker') {
        inferenceWorker.postMessage(message.data)
    }
})

inferenceWorker.onmessage = async (event) => {
    if (event.data.action === 'classification') {
        sendToForeground('toTopic', event.data.answer)
    } else if (event.data.status === 'partial') {
        sendToForeground('floatRight')
        sendToForeground('toInputField', event.data.input + '//:fold')
    } else if (event.data.status === 'complete') {
        if (event.data.output.length > 2) {
            sendToForeground('toOutputField', event.data.output)
            // gun.send(event.data.output)
        }
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
