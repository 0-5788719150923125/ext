import { pipeline, env } from '@xenova/transformers'
import db from './db.js'
import { delay, eventHandler, randomBetween } from './common.js'

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1
env.allowLocalModels = true

// Proxy the WASM backend to prevent the UI from freezing
env.backends.onnx.wasm.proxy = true

// Use the Singleton pattern to enable lazy construction of the pipeline.
class InferenceSingleton {
    static task = 'text-generation'
    static instance = null

    static async getInstance(model, progress_callback = null) {
        model = model === null ? 'Xenova/LaMini-Neo-125M' : model

        if (this.instance === null) {
            this.instance = pipeline(this.task, model, {
                progress_callback
            })
        }

        return this.instance
    }
}

// class ClassifierSingleton {
//     static task = 'question-answering'
//     static instance = null

//     static async getInstance(model, progress_callback = null) {
//         if (this.instance === null) {
//             this.instance = pipeline(this.task, model, {
//                 progress_callback
//             })
//         }

//         return this.instance
//     }
// }

class ClassifierSingleton {
    static task = 'fill-mask'
    static instance = null

    static async getInstance(model, progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, model, {
                progress_callback
            })
        }

        return this.instance
    }
}

function randomValueFromArray(array, biasFactor = 1) {
    const randomIndex = Math.floor(
        Math.pow(Math.random(), biasFactor) * array.length
    )
    return array[randomIndex]
}

// Create generic classify function
const classify = async (context, options) => {
    try {
        let model = await ClassifierSingleton.getInstance(
            'Xenova/bert-base-cased'
        )

        const outputs = await model(
            context + 'The topic of this conversation is about [MASK].',
            {
                topk: 3
            }
        )
        const choice = randomValueFromArray(outputs)
        return choice.token_str
    } catch (err) {
        console.error(err)
    }
}

function sendMessage(data) {
    if (typeof self !== 'undefined' && self.postMessage) {
        // Web Worker context
        self.postMessage(data)
    } else {
        // Service Worker context
        eventHandler({ data })
    }
}

export async function doInference(data) {
    try {
        const { action, prompt, generatorOptions } = data

        // Get the pipeline instance. This will load and build the model when run for the first time.
        let output = await classify(prompt, generatorOptions)
        if (output) {
            sendMessage({
                action: 'toTopic',
                answer: cleanPrediction(output)
            })
        }

        const roll = Math.random()
        if (roll >= generatorOptions.frequency) return

        // Get the pipeline instance. This will load and build the model when run for the first time.
        let generator = await InferenceSingleton.getInstance(
            generatorOptions?.model
        )

        const outputChars = []

        // Run the model on the input text
        await generator(prompt, {
            ...generatorOptions,
            callback_function: (beams) => {
                const partial = generator.tokenizer.decode(
                    beams[0].output_token_ids,
                    {
                        skip_special_tokens: true
                    }
                )

                const prediction = cleanPrediction(partial, prompt)

                for (const i in prediction.split('')) {
                    outputChars[i] = {
                        char: prediction[i],
                        delivered: outputChars[i]?.delivered
                            ? outputChars[i].delivered
                            : false
                    }
                }
            }
        })

        let shouldReturn = false
        while (true) {
            await delay(randomBetween(50, 200))
            let output = ''
            for (const i in outputChars) {
                shouldReturn = true
                output += outputChars[i].char
                if (!outputChars[i].delivered) {
                    sendMessage({
                        status: 'partial',
                        input: output
                    })
                    outputChars[i].delivered = true
                    shouldReturn = false
                    break
                }
            }
            if (shouldReturn) {
                if (output.length > 2) {
                    sendMessage({ status: 'complete', output })
                    db.emit('toRouter', { action: 'toDatabase', data: output })
                }
                break
            }
        }
    } catch (error) {
        sendMessage({ status: 'error', error })
    }
    sendMessage({ status: 'complete', output: '' })
}

function cleanPrediction(output, prompt = '') {
    let clean = output.replace(prompt, '')
    while (clean.startsWith('\n')) {
        clean = clean.slice(1)
    }

    const trailingNewlines = clean.indexOf('\n')
    if (trailingNewlines >= 0) {
        clean = clean.slice(0, trailingNewlines)
    }

    if ((clean.split(`"`).length - 1) % 2 !== 0) {
        if (clean.endsWith(`"`)) {
            clean = clean.slice(0, -1)
        }
    }

    while (clean.startsWith('¶') || clean.startsWith(' ')) {
        clean = clean.slice(1)
    }

    let pilcrowIndex = clean.indexOf('¶')
    if (pilcrowIndex >= 0) {
        clean = clean.slice(0, pilcrowIndex).trim()
    }

    return clean
}
