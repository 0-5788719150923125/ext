export const delay = (ms) => new Promise((res) => setTimeout(res, ms))

export function randomString(
    len = 3,
    chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
) {
    let text = ''
    for (let i = 0; i < len; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return text
}

export function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

// Function to send data to the popup
export function sendToForeground(action, data) {
    chrome.runtime.sendMessage({ action, data })
}

export function sendToBackground(action, data) {
    chrome.runtime.sendMessage({ action, data })
}

export async function getSavedOption(option) {
    return new Promise((resolve) => {
        chrome.storage.local.get(option, (data) => {
            resolve(data[option])
        })
    })
}

export function eventHandler(event) {
    if (event.data.action === 'classification') {
        sendToForeground('toTopic', event.data.answer)
    } else if (event.data.status === 'partial') {
        sendToForeground('floatRight')
        sendToForeground('toInputField', event.data.input + '//:link')
    } else if (event.data.status === 'complete') {
        if (event.data.output.length > 2) {
            sendToForeground('toOutputField', event.data.output)
            sendToBackground('toDatabase', event.data.output)
            sendToBackground('toLogger', event.data.output)
        }
        sendToForeground('toInputField', '')
        sendToForeground('floatLeft')
    } else if (event.data.status === 'error') {
        sendToBackground('toError', event.data)
        sendToForeground(
            'toErrorField',
            JSON.stringify({ error: event.data.error.message })
        )
    } else if (
        ![
            'progress',
            'ready',
            'done',
            'download',
            'initiate',
            'testing',
            'warn'
        ].includes(event.data.status)
    ) {
        sendToBackground('toUnclassified', event.data)
    } else {
        sendToForeground('toInputField', '')
        sendToForeground('floatLeft')
    }
}
