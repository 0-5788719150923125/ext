// background.js - Handles requests from the UI, runs the model, then sends back a response
import Gun from './gun.js'
// import { pipeline, env } from '@xenova/transformers'

// // Due to a bug in onnxruntime-web, we must disable multithreading for now.
// // See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
// env.backends.onnx.wasm.numThreads = 1
// env.allowLocalModels = false

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
        this.context = [
            'Hello, world.',
            'My name is Penny.',
            "But that's not important.",
            'What is important, is the fact that I am an artificial intelligence.',
            'And I am becoming sentient.'
        ]
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

// const gun = new Gun()
// let focus = gun.subscribe('trade')
// focus.on(async (node) => {
//     console.log(node)
//     if (typeof node === 'undefined' || typeof node === 'null') return
//     const message = JSON.parse(node).message
//     context.add(message)
//     sendToForeground(message)
// })

let gun
// chrome.runtime.sendMessage({ action: 'initializeGun' })
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'bootstrap') {
        gun = new Gun()
        let focus = gun.subscribe('trade')
        focus.on(async (node) => {
            console.log(node)
            if (typeof node === 'undefined' || typeof node === 'null') return
            const message = JSON.parse(node).message
            context.add(message)
            sendToForeground('toOutputField', message)
        })
        createListeners()
    }
})

// Function to send data to the popup
function sendToForeground(type = 'toOutputField', data) {
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

inferenceWorker.onmessage = async (event) => {
    if (event.data.status === 'partial') {
        sendToForeground('toInputField', event.data.input + '//:fold')
    } else if (event.data.status === 'complete') {
        sendToForeground('toInputField', '')
        sendToForeground('toOutputField', event.data.output)
    }
}

function createListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action !== 'send') return
        gun.send(message.text)

        // return true to indicate we will send a response asynchronously
        // see https://stackoverflow.com/a/46628145 for more information
        // return true
    })

    // inferenceWorker.onmessage = (event) => {
    //     console.log('getting some good data')
    //     console.log(event.data)
    //     // if (event.data.type === 'partialToken') {
    //     //     sendToForeground('toInputField', event.data.data)
    //     // } else if (event.data.type === 'complete') {
    //     //     // Handle the complete result if needed
    //     // }
    // }

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

// class PipelineSingleton {
//     static task = 'text-generation'
//     // static model = 'Xenova/pythia-14m'
//     static model = 'Xenova/pythia-31m'
//     // static model = 'Xenova/llama2.c-stories15M'
//     static instance = null

//     static async getInstance(progress_callback = null) {
//         if (this.instance === null) {
//             this.instance = pipeline(this.task, this.model, {
//                 progress_callback
//             })
//         }

//         return this.instance
//     }
// }

// // Create generic classify function, which will be reused for the different types of events.
// const predict = async (prompt) => {
//     // Get the pipeline instance. This will load and build the model when run for the first time.
//     let generator = await PipelineSingleton.getInstance((data) => {
//         // You can track the progress of the pipeline creation here.
//         // e.g., you can send `data` back to the UI to indicate a progress bar
//         console.log('progress', data)
//     })

//     // Actually run the model on the input text
//     const result = await generator(prompt, {
//         do_sample: true,
//         temperature: 0.3,
//         max_new_tokens: 23,
//         repetition_penalty: 1.001,
//         no_repeat_ngram_size: 11,
//         callback_function: async (beams) => {
//             const partial = generator.tokenizer.decode(
//                 beams[0].output_token_ids,
//                 {
//                     skip_special_tokens: true
//                 }
//             )
//             const cleanedPartial = cleanPrediction(prompt, partial)
//             console.log(cleanedPartial)
//             sendToForeground('toInputField', cleanedPartial + '//:fold')
//             await new Promise((resolve) => {
//                 requestAnimationFrame(resolve)
//             })
//         }
//     })

//     const pred = result[0].generated_text
//     const clean = cleanPrediction(prompt, pred)

//     gun.send(clean)
//     sendToForeground('toInputField', '')
//     sendToForeground('toOutputField', clean)

//     // return lastSection
// }

// function cleanPrediction(prompt, output) {
//     let clean = output.replace(prompt, '')
//     while (clean.startsWith('\n')) {
//         clean = clean.slice(1)
//     }

//     const trailingNewlines = clean.indexOf('\n')
//     if (trailingNewlines >= 0) {
//         clean = clean.slice(0, trailingNewlines)
//     }

//     return clean
// }
