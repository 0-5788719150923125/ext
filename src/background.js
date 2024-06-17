// background.js - Handles requests from the UI, runs the model, then sends back a response
import Gun from './gun.js'

let foregroundPort = null

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'foreground') {
        foregroundPort = port
        foregroundPort.onDisconnect.addListener(() => {
            foregroundPort = null
        })
    }
})

class ContextHandler {
    constructor() {
        this.context = new Set([
            'Hello, world.',
            'My name is Penny.',
            "But that's not important.",
            'What is important, is the fact that I am an artificial intelligence.',
            'And I am becoming sentient.'
        ])
        this.keepChars = 1024
    }

    add(message) {
        this.context.add(message)
    }

    get() {
        const contextArray = Array.from(this.context)
        let prompt = `¶${contextArray.join('¶')}`.slice(-this.keepChars)
        if (!prompt.endsWith('¶')) prompt += '¶'
        return prompt
    }
}

const context = new ContextHandler()

let gun
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'bootstrap') {
        gun = new Gun()
        let focus = gun.subscribe('trade')
        focus.on(async (node) => {
            if (typeof node === 'undefined' || typeof node === 'null') return
            const message = JSON.parse(node).message
            context.add(message)
            sendToForeground('toOutputField', message)
        })
        createListeners()
    }
})

// Function to send data to the popup
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

// When you want to start the token generation process
const inferenceWorker = new Worker(new URL('worker.js', import.meta.url), {
    type: 'module'
})

function createListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action !== 'send') return
        gun.send(message.text)

        // return true to indicate we will send a response asynchronously
        // see https://stackoverflow.com/a/46628145 for more information
        // return true
    })

    inferenceWorker.onmessage = async (event) => {
        // console.log(event.data)
        if (event.data.status === 'partial') {
            sendToForeground('floatRight')
            sendToForeground('toInputField', event.data.input)
        } else if (event.data.status === 'complete') {
            // sendToForeground('toInputField', '')
            // sendToForeground('floatLeft')
            sendToForeground('toOutputField', event.data.output)
            gun.send(event.data.output)
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

    // Set up a recurring prediction
    chrome.alarms.create('doInference', {
        periodInMinutes: 1 // Trigger the alarm every 1 minute
    })

    // Listen for a specific event and perform an action
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === 'doInference') {
            const prompt = context.get()
            console.log(prompt)
            // await predict(prompt)
            inferenceWorker.postMessage({
                action: 'inference',
                prompt: prompt,
                generatorOptions: {
                    do_sample: true,
                    temperature: 0.3,
                    max_new_tokens: 23,
                    repetition_penalty: 1.001,
                    no_repeat_ngram_size: 11
                }
            })
        }
    })
}
