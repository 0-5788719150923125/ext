// background.js - Handles requests from the UI, runs the model, then sends back a response
import Gun from './gun.js'
import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1

const gun = new Gun()
const focus = gun.subscribe('trade')
focus.on(async (node) => {
    if (typeof node === 'undefined' || typeof node === 'null') return
    sendDataToPopup(JSON.parse(node).message)
})

// Function to send data to the popup
function sendDataToPopup(data) {
    chrome.runtime.sendMessage({ type: 'update', data: data })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== 'send') return
    gun.send(message.text)
    // gun.send(data)
    // // Run model prediction asynchronously
    // ;(async function () {
    //     // Perform classification
    //     let result = await classify(message.text)

    //     // Send response back to UI
    //     sendResponse(result)
    // })()

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

    // Actually run the model on the input text
    let result = await generator(text, {
        do_sample: true,
        temperature: 7.0,
        max_new_tokens: 10,
        repetition_penalty: 1.5,
        no_repeat_ngram_size: 7
    })

    console.log(result)

    sendDataToPopup(result[0].generated_text)
    gun.send(result[0].generated_text)

    return result[0].generated_text
}
