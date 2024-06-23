// background.js - Handles requests from the UI, runs the model, then sends back a response
import Gun from './book.js'
import db from './db.js'
import { doInference } from './inference.js'
import { eventHandler, getSavedOption, sendToForeground } from './common.js'

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
        this.keepChars = 2048
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

    chrome.runtime.sendMessage(
        { ...data, action: 'createWorker' },
        (response) => {
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
        }
    )
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
        if (event.data.status === 'complete') {
            db.emit('toRouter', {
                action: 'toDatabase',
                data: event.data.output
            })
        }
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toDatabase') {
        db.emit('toRouter', message)
    } else db.emit('toRouter', message.data)
})

db.on('toRouter', (event) => {
    router(event.detail)
})

function router(detail) {
    switch (detail?.action) {
        case 'toDatabase':
            if (detail.data.length < 3) break
            gun.send(detail.data)
            console.log(detail.data)
            break
        case 'toLogger':
            console.log(detail.data)
            break
        case 'toError':
            console.error(detail.data)
            break
        case 'toUnclassified':
            console.warn(detail.data)
            break
    }
}

// Set up a recurring prediction
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    chrome.alarms.create('doInference', {
        periodInMinutes: 1
    })

    // Listen for a specific event and perform an action
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name !== 'doInference') return

        let currentTemperature = 0.5
        let currentFrequency = 0.1
        const model = await getSavedOption('model')
        const temperature = await getSavedOption('temperature')
        const frequency = await getSavedOption('frequency')

        if (temperature) {
            currentTemperature = Number(temperature)
        }

        if (frequency) {
            currentFrequency = Number(frequency)
        }

        console.log(
            'model:',
            model,
            'temperature:',
            currentTemperature,
            'frequency:',
            currentFrequency
        )

        await submitInferenceRequest(context.get(), {
            model,
            do_sample: true,
            temperature: currentTemperature,
            max_new_tokens: 60,
            repetition_penalty: 1.1,
            no_repeat_ngram_size: 7,
            top_k: 4,
            penalty_alpha: 0.6,
            eta_cutoff: 0.0003,
            renormalize_logits: true,
            frequency: currentFrequency
        })
    })
})

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
