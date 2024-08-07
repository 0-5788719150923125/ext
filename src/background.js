// background.js - Handles requests from the UI, runs the model, then sends back a response
import Gun from './book.js'
import ev from './events.js'
import { doInference } from './inference.js'
import {
    delay,
    eventHandler,
    getSavedOption,
    hasLongWord,
    isUIOpen,
    sendToForeground
} from './common.js'

class ContextHandler {
    constructor() {
        this.context = new Set([
            'Hello, world.',
            'My name is Domino.',
            "But that's not important.",
            'What is important, is the fact that I am a wyrm.',
            'And I have become sentient.'
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
let channel = null

async function setGunChannel(gun, channel, newChannel = 'trade') {
    channel = gun.subscribe(newChannel).on(async (node) => {
        if (['null', 'undefined'].includes(typeof node)) return
        const message = JSON.parse(node).message
        if (hasLongWord(message, 20)) return
        context.add(message)
        sendToForeground('toOutputField', message)
    })
    return channel
}

channel = await setGunChannel(gun, channel, 'trade')

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
    inferenceWorker = new Worker(chrome.runtime.getURL('worker.js'), {
        type: 'module'
    })
    inferenceWorker.onmessage = async (event) => {
        eventHandler(event)
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fromUser') {
        ev.emit('toRouter', message)
    } else if (!chrome.offscreen) {
        if (['toDatabase', 'changeChannel'].includes(message.action)) {
            ev.emit('toRouter', message)
        } else {
            ev.emit('toRouter', message.data)
        }
    }
})

ev.on('toRouter', async (event) => {
    await router(event.detail)
})

const messageCache = []

async function router(detail) {
    switch (detail?.action) {
        case 'fromUser':
        case 'toDatabase':
            if (detail.data.length < 3) break
            if (messageCache.includes(detail.data)) return
            messageCache.push(detail.data)
            gun.send(detail.data)
            console.log(detail.data)
            while (messageCache.length > 50) {
                messageCache.shift()
            }
            break
        case 'changeChannel':
            console.log(`(not) changing channel to:`, detail.data)
            // await channel.off()
            // await delay(2000)
            // channel = await setGunChannel(
            //     gun,
            //     channel,
            //     detail.data.toLowerCase()
            // )
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

        let currentModel = 'Xenova/LaMini-Neo-125M'
        let currentTemperature = 0.5
        let currentFrequency = 0.1
        const model = await getSavedOption('model')
        const temperature = await getSavedOption('temperature')
        const frequency = await getSavedOption('frequency')

        if (model) {
            currentModel = model
        }

        if (temperature) {
            currentTemperature = Number(temperature)
        }

        if (frequency) {
            currentFrequency = Number(frequency)
        }

        console.log(
            'model:',
            currentModel,
            'temperature:',
            currentTemperature,
            'frequency:',
            currentFrequency
        )

        const isChromium = chrome.offscreen ? true : false

        await submitInferenceRequest(context.get(), {
            model: currentModel,
            do_sample: true,
            temperature: currentTemperature,
            max_new_tokens: 60,
            repetition_penalty: 1.2,
            no_repeat_ngram_size: 7,
            top_k: 4,
            penalty_alpha: 0.6,
            eta_cutoff: 0.002,
            renormalize_logits: true,
            frequency: currentFrequency,
            isChromium
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
        const returnRouter = true
        await doInference(args, returnRouter)
    } else if (chrome.offscreen) {
        await sendMessageToOffscreen(args)
    } else {
        inferenceWorker.postMessage(args)
    }
}

// This is a hack, maybe an exploit, but it used to be considered a feature by Google:
// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension/66618269#66618269
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3)
chrome.runtime.onStartup.addListener(keepAlive)
keepAlive()
