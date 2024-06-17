// background.js - Handles requests from the UI, runs the model, then sends back a response
import Gun from './gun.js'

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
    gun.send(data)
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
    return true
})

// Example: Listen for a specific event and perform an action
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'doInference') {
        // Perform the desired action
        console.log('Alarm triggered')
        const result = await predict('I think')
        // Update the extension icon or perform other tasks
        //   updateExtensionIcon();
        // sendDataToPopup(Math.random().toString())
        sendDataToPopup(result)
        gun.send(result)
    }
})

// Example: Set up a recurring alarm
chrome.alarms.create('doInference', {
    periodInMinutes: 1 // Trigger the alarm every 1 minute
})

import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1

class PipelineSingleton {
    static task = 'text-generation'
    // static model = 'Xenova/pythia-14m'
    static model = 'Xenova/llama2.c-stories15M'
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
    return result[0].generated_text
}

// // Example: Send data to the popup every 5 seconds
// setInterval(() => {
//     const data = {
//         connectedPeers: getConnectedPeers()
//         // Other data you want to send
//     }
//     // sendDataToPopup(data.connectedPeers)
// }, 5000)

// // Function to get the number of connected peers (replace with your own logic)
// function getConnectedPeers() {
//     // Placeholder implementation
//     return Math.floor(Math.random() * 100)
// }

// import { pipeline, env } from '@xenova/transformers'

// // Skip initial check for local models, since we are not loading any local models.
// env.allowLocalModels = false

// // Due to a bug in onnxruntime-web, we must disable multithreading for now.
// // See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
// env.backends.onnx.wasm.numThreads = 1

// class PipelineSingleton {
//     static task = 'text-classification'
//     static model = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
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
// const classify = async (text) => {
//     // Get the pipeline instance. This will load and build the model when run for the first time.
//     let model = await PipelineSingleton.getInstance((data) => {
//         // You can track the progress of the pipeline creation here.
//         // e.g., you can send `data` back to the UI to indicate a progress bar
//         // console.log('progress', data)
//     })

//     // Actually run the model on the input text
//     let result = await model(text)
//     return result
// }

// ////////////////////// 1. Context Menus //////////////////////
// //
// // Add a listener to create the initial context menu items,
// // context menu items only need to be created at runtime.onInstalled
// chrome.runtime.onInstalled.addListener(function () {
//     // Register a context menu item that will only show up for selection text.
//     chrome.contextMenus.create({
//         id: 'classify-selection',
//         title: 'Classify "%s"',
//         contexts: ['selection']
//     })
// })

// // Perform inference when the user clicks a context menu
// chrome.contextMenus.onClicked.addListener(async (info, tab) => {
//     // Ignore context menu clicks that are not for classifications (or when there is no input)
//     if (info.menuItemId !== 'classify-selection' || !info.selectionText) return

//     // Perform classification on the selected text
//     let result = await classify(info.selectionText)

//     // Do something with the result
//     chrome.scripting.executeScript({
//         target: { tabId: tab.id }, // Run in the tab that the user clicked in
//         args: [result], // The arguments to pass to the function
//         function: (result) => {
//             // The function to run
//             // NOTE: This function is run in the context of the web page, meaning that `document` is available.
//             console.log('result', result)
//             console.log('document', document)
//         }
//     })
// })
// //////////////////////////////////////////////////////////////

// ////////////////////// 2. Message Events /////////////////////
// //
// // Listen for messages from the UI, process it, and send the result back.
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     console.log('sender', sender)
//     if (message.action !== 'classify')
//         return // Ignore messages that are not meant for classification.
//         // Run model prediction asynchronously
//     ;(async function () {
//         // Perform classification
//         let result = await classify(message.text)

//         // Send response back to UI
//         sendResponse(result)
//     })()

//     // return true to indicate we will send a response asynchronously
//     // see https://stackoverflow.com/a/46628145 for more information
//     return true
// })
// //////////////////////////////////////////////////////////////
