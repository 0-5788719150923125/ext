// background.js - Handles requests from the UI, runs the model, then sends back a response
import Gun from './gun.js'
import { pipeline, env } from '@xenova/transformers'

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1
env.allowLocalModels = false

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
        this.context = []
        this.keepChars = 1024
    }

    add(message) {
        this.context.push(message)
    }

    get() {
        let prompt = `¶${this.context.join('¶')}`.slice(-this.keepChars)
        if (!prompt.endsWith('¶')) prompt += '¶'
        return prompt
    }
}

const context = new ContextHandler()

const gun = new Gun()
let focus = gun.subscribe('trade')
focus.on(async (node) => {
    console.log(node)
    if (typeof node === 'undefined' || typeof node === 'null') return
    const message = JSON.parse(node).message
    context.add(message)
    sendToForeground(message)
})

setTimeout(function request() {
    console.log('tick')
    focus = gun.subscribe('trade')
    gun.send('tick')
    setTimeout(request, 5000)
}, 5000)

setTimeout(function request() {
    console.log('tock')
    focus = gun.subscribe('trade')
    gun.send('tock')
    setTimeout(request, 5000)
}, 5000)

// Function to send data to the popup
function sendToForeground(data) {
    if (foregroundPort) {
        foregroundPort.postMessage({ type: 'update', data: data })
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== 'send') return
    gun.send(message.text)

    // return true to indicate we will send a response asynchronously
    // see https://stackoverflow.com/a/46628145 for more information
    // return true
})

// Set up a recurring prediction
chrome.alarms.create('doInference', {
    periodInMinutes: 1 // Trigger the alarm every 1 minute
})

// Listen for a specific event and perform an action
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'doInference') {
        await predict('I think')
    }
})

class PipelineSingleton {
    static task = 'text-generation'
    static model = 'Xenova/pythia-14m'
    // static model = 'Xenova/llama2.c-stories15M'
    static instance = null

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, {
                progress_callback
            })
        }

        return this.instance
    }
}

// Create generic classify function, which will be reused for the different types of events.
const predict = async (text) => {
    // Get the pipeline instance. This will load and build the model when run for the first time.
    let generator = await PipelineSingleton.getInstance((data) => {
        // You can track the progress of the pipeline creation here.
        // e.g., you can send `data` back to the UI to indicate a progress bar
        // console.log('progress', data)
    })

    const prompt = context.get()
    console.log(prompt)

    // Actually run the model on the input text
    let result = await generator(prompt, {
        do_sample: true,
        temperature: 0.7,
        max_new_tokens: 23,
        repetition_penalty: 1.1,
        no_repeat_ngram_size: 11
    })

    const pred = result[0].generated_text
    const clean = pred.replace(prompt, '')

    console.log(clean)

    gun.send(clean)
    sendToForeground(clean)

    // return lastSection
}
