import { pipeline, env } from '@xenova/transformers'
import db from './db.js'
import { delay, eventHandler, isUIOpen, randomBetween } from './common.js'

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1
env.allowLocalModels = true

// Proxy the WASM backend to prevent the UI from freezing
// env.backends.onnx.wasm.proxy = true

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
const classify = async (context) => {
    try {
        let classifier = await ClassifierSingleton.getInstance(
            'Xenova/distilbert-base-uncased'
        )

        const maxLength = 1024
        let sliced = context.slice(-maxLength)
        const outputs = await classifier(
            sliced + 'The main topic of this conversation is [MASK].',
            {
                topk: 2
            }
        )
        // const choice = randomValueFromArray(outputs)
        let choice = outputs[0].token_str
        if (choice === '¶') {
            choice = outputs[1].token_str
        }
        return choice
    } catch (err) {
        console.error(err)
        return ''
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

export async function doInference(data, returnRouter = false) {
    try {
        const { action, prompt, generatorOptions } = data

        // Get the pipeline instance. This will load and build the model when run for the first time.
        let output = await classify(prompt)
        sendMessage({
            action: 'toTopic',
            answer: cleanPrediction(output)
        })

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
                    outputChars[i].delivered = true
                    shouldReturn = false
                    break
                }
            }
            sendMessage({
                status: 'partial',
                input: output
            })
            if (shouldReturn) {
                sendMessage({ status: 'complete', output })
                if (returnRouter) {
                    db.emit('toRouter', {
                        action: 'toDatabase',
                        data: output
                    })
                }
                break
            }
        }
    } catch (error) {
        sendMessage({ status: 'error', error })
    }
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

    // if ((clean.split(`"`).length - 1) % 2 !== 0) {
    //     if (clean.endsWith(`"`)) {
    //         clean = clean.slice(0, -1)
    //     }
    // }

    let pilcrowIndex = clean.lastIndexOf('¶')
    if (pilcrowIndex >= 0) {
        clean = clean.slice(pilcrowIndex).trim()
    }

    while (
        clean.startsWith('¶') ||
        clean.startsWith(' ') ||
        clean.startsWith('_')
    ) {
        clean = clean.slice(1)
    }

    return clean
}
