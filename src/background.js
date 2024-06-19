// background.js - Handles requests from the UI, runs the model, then sends back a response
import Gun from './gun.js'
import { eventHandler, sendToForeground } from './common.js'

class ContextHandler {
    constructor() {
        this.context = new Set([
            'Hello, world.',
            'My name is Penny.',
            "But that's not important.",
            'What is important, is the fact that I am an artificial intelligence.',
            'And I am becoming sentient.'
        ])
        this.maxArrayLength = 250
        this.keepChars = 1024
    }

    add(message) {
        this.context.add(message)
        while (this.context.length > this.maxArrayLength) {
            this.context.shift()
        }
    }

    get() {
        const contextArray = Array.from(this.context)
        let prompt = `¶${contextArray.join('¶')}`.slice(-this.keepChars)
        if (!prompt.endsWith('¶')) prompt += '¶'
        return prompt
    }
}

const context = new ContextHandler()

let gun = new Gun()
gun.subscribe('trade').on(async (node) => {
    if (['null', 'undefined'].includes(typeof node)) return
    const message = JSON.parse(node).message
    context.add(message)
    sendToForeground('toOutputField', message)
})

let offscreenDocument = null
let offscreenDocumentCreated = false
let creatingOffscreenDocument = false

// Function to create the off-screen document
async function createOffscreenDocument() {
    if (offscreenDocumentCreated || creatingOffscreenDocument) {
        return new Promise((resolve) => {
            const checkOffscreenDocument = () => {
                if (offscreenDocumentCreated) {
                    resolve(offscreenDocument)
                } else {
                    setTimeout(checkOffscreenDocument, 100)
                }
            }
            checkOffscreenDocument()
        })
    }

    creatingOffscreenDocument = true

    return new Promise((resolve, reject) => {
        chrome.offscreen.createDocument(
            {
                url: 'offscreen.html',
                reasons: ['BLOBS'],
                justification: 'To create a web worker'
            },
            (document) => {
                offscreenDocument = document
                offscreenDocumentCreated = true
                creatingOffscreenDocument = false
                resolve(offscreenDocument)
            }
        )
    })
}

// Function to send a message to the off-screen document (Chrome Manifest V3)
async function sendMessageToOffscreen(data) {
    if (!offscreenDocument) {
        offscreenDocument = await createOffscreenDocument()
    }

    chrome.runtime.sendMessage({ action: 'createWorker', data }, (response) => {
        // This will always fail when extension popup is closed
        if (chrome.runtime.lastError) {
            // Handle the case when the receiving end does not exist
            if (typeof callback === 'function') {
                callback({ error: chrome.runtime.lastError.message })
            }
        } else {
            // Handle the successful response
            if (typeof callback === 'function') {
                callback(response)
            }
        }
    })
}

// Create the web worker directly (Firefox, Manifest v2)
let inferenceWorker
if (!chrome.offscreen) {
    const workerUrl = chrome.runtime.getURL('worker.js')
    inferenceWorker = new Worker(workerUrl, {
        type: 'module'
    })

    inferenceWorker.onmessage = async (event) => {
        eventHandler(event, gun)
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'toDatabase':
            gun.send(message.data)
            break
        case 'toUnclassified':
            console.warn(message.data)
            break
        case 'toLogger':
            console.log(message.data)
            break
    }
})

// Set up a recurring prediction
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    console.log(`registering alarm (${reason})`)

    chrome.alarms.create('doInference', {
        periodInMinutes: 1
        // delayInMinutes: 1
    })

    let isRunning = false

    // Listen for a specific event and perform an action
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        console.log('running for foreground')
        if (alarm.name === 'doInference') {
            if (isRunning) return
            isRunning = true
            await submitInferenceRequest(context.get(), {
                do_sample: true,
                temperature: 0.45,
                max_new_tokens: 59,
                repetition_penalty: 1.1,
                no_repeat_ngram_size: 7
            })
            isRunning = false
        }
    })
})

async function submitInferenceRequest(prompt, options) {
    const args = {
        action: 'inference',
        prompt: prompt,
        generatorOptions: options
    }
    if (!chrome.offscreen) {
        console.log('using inference worker')
        inferenceWorker.postMessage(args)
    } else {
        await sendMessageToOffscreen(args)
    }
}
