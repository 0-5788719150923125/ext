import { pipeline, env } from '@xenova/transformers'

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1
env.allowLocalModels = false

// Use the Singleton pattern to enable lazy construction of the pipeline.
class PipelineSingleton {
    static task = 'text-generation'
    // static model = 'Xenova/pythia-14m'
    static model = 'Xenova/pythia-31m'
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

self.onmessage = async function (event) {
    console.log('received an event from background.js')
    self.postMessage('received an event from background.js')
    if (event.data.action !== 'inference') return
    try {
        // Get the pipeline instance. This will load and build the model when run for the first time.
        let generator = await PipelineSingleton.getInstance((data) => {
            // You can track the progress of the pipeline creation here.
            // e.g., you can send `data` back to the UI to indicate a progress bar
            console.log('progress', data)
            self.postMessage(data)
        })

        const { prompt, generatorOptions } = event.data

        // Actually run the model on the input text
        const result = await generator(prompt, {
            ...generatorOptions,
            callback_function: (beams) => {
                const partial = generator.tokenizer.decode(
                    beams[0].output_token_ids,
                    {
                        skip_special_tokens: true
                    }
                )
                const cleanedPartial = cleanPrediction(prompt, partial)
                console.log(cleanedPartial)
                // sendToForeground('toInputField', cleanedPartial + '//:fold')
                self.postMessage({ status: 'partial', input: cleanedPartial })
                // await new Promise((resolve) => {
                //     requestAnimationFrame(resolve)
                // })
            }
        })

        const pred = result[0].generated_text
        const clean = cleanPrediction(prompt, pred)

        // gun.send(clean)
        // sendToForeground('toInputField', '')
        // sendToForeground('toOutputField', clean)
        self.postMessage({ status: 'complete', output: clean })
    } catch (err) {
        console.error(err)
        self.postMessage(err)
    }
}

// // Listen for messages from the main thread
// self.addEventListener('message', async (event) => {
//     console.log('received an event from background.js')
//     try {
//         // Get the pipeline instance. This will load and build the model when run for the first time.
//         let generator = await PipelineSingleton.getInstance((data) => {
//             // You can track the progress of the pipeline creation here.
//             // e.g., you can send `data` back to the UI to indicate a progress bar
//             console.log('progress', data)
//             self.postMessage(data)
//         })

//         const { prompt, generatorOptions } = event.data

//         // Actually run the model on the input text
//         const result = await generator(prompt, {
//             ...generatorOptions,
//             callback_function: (beams) => {
//                 const partial = generator.tokenizer.decode(
//                     beams[0].output_token_ids,
//                     {
//                         skip_special_tokens: true
//                     }
//                 )
//                 const cleanedPartial = cleanPrediction(prompt, partial)
//                 console.log(cleanedPartial)
//                 // sendToForeground('toInputField', cleanedPartial + '//:fold')
//                 self.postMessage({ status: 'partial', output: cleanedPartial })
//                 // await new Promise((resolve) => {
//                 //     requestAnimationFrame(resolve)
//                 // })
//             }
//         })

//         const pred = result[0].generated_text
//         const clean = cleanPrediction(prompt, pred)

//         // gun.send(clean)
//         // sendToForeground('toInputField', '')
//         // sendToForeground('toOutputField', clean)
//         self.postMessage({ status: 'complete', output: clean })
//     } catch (err) {
//         console.error(err)
//         self.postMessage(err)
//     }
// })

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

function cleanPrediction(prompt, output) {
    let clean = output.replace(prompt, '')
    while (clean.startsWith('\n')) {
        clean = clean.slice(1)
    }

    const trailingNewlines = clean.indexOf('\n')
    if (trailingNewlines >= 0) {
        clean = clean.slice(0, trailingNewlines)
    }

    return clean
}
