// background.js - Handles requests from the UI, runs the model, then sends back a response
import Gun from './book.js'
import {
    eventHandler,
    getSavedOption,
    sendToBackground,
    sendToForeground
} from './common.js'

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
    console.log('from gun:', message)
    context.add(message)
    sendToForeground('toOutputField', message)
    sendToBackground('toLogger', `from gun: ${message}`)
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
        eventHandler(event)
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
            console.warn(message.data)
            break
        case 'toError':
            console.error(message.data)
            break
    }
})

// Set up a recurring prediction
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    chrome.alarms.create('doInference', {
        periodInMinutes: 1
        // delayInMinutes: 1
    })

    // Listen for a specific event and perform an action
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name !== 'doInference') return

        let currentFrequency = 0.1
        const frequency = await getSavedOption('frequency')
        const model = await getSavedOption('model')

        if (frequency) {
            currentFrequency = Number(frequency)
        }

        console.log('model:', model, 'frequency:', currentFrequency)

        await submitInferenceRequest(context.get(), {
            model,
            do_sample: true,
            temperature: 0.45,
            max_new_tokens: 59,
            repetition_penalty: 1.1,
            no_repeat_ngram_size: 7,
            frequency: currentFrequency
        })
    })
})

import { doInference } from './inference.js'

async function submitInferenceRequest(prompt, options) {
    const args = {
        action: 'inference',
        prompt: prompt,
        generatorOptions: options
    }

    if (!(await isUIOpen())) {
        await doInference(args)
    } else if (chrome.offscreen) {
        await sendMessageToOffscreen(args)
    } else {
        inferenceWorker.postMessage(args)
    }
}

async function isUIOpen() {
    const manifest = chrome.runtime.getManifest()

    if (manifest.manifest_version > 2) {
        return (
            (await chrome.runtime.getContexts({
                contextTypes: ['POPUP', 'TAB']
            }).length) > 0
        )
    } else {
        return (
            chrome.extension.getViews({ type: 'popup' }).length > 0 ||
            chrome.extension.getViews({ type: 'tab' }).length > 0
        )
    }
}

// This is a hack, maybe an exploit, but it used to be considered a feature by Google:
// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension/66618269#66618269
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3)
chrome.runtime.onStartup.addListener(keepAlive)
keepAlive()
