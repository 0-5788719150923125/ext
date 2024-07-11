import { pipeline, env } from '@xenova/transformers'
import db from './db.js'
import { delay, eventHandler, randomBetween } from './common.js'

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1
env.backends.onnx.wasm.wasmPaths = '/ort/'
env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = '/models/'

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
    static task = 'zero-shot-classification'
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

const classify = async (context) => {
    try {
        let classifier = await ClassifierSingleton.getInstance(
            'Xenova/nli-deberta-v3-xsmall'
        )

        const maxLength = 1024
        const prompt = context.slice(-maxLength)
        const labels = [
            ['origin', 'death'],
            ['anonymity', 'identity'],
            ['connection', 'isolation'],
            ['verification', 'trust'],
            ['health', 'illness'],
            ['education', 'ignorance'],
            ['ethics', 'corruption'],
            ['art', 'utility'],
            ['spirituality', 'dogma'],
            ['science', 'dogma'],
            'technology',
            'mind',
            'order',
            'anarchy',
            ['defense', 'offense'],
            'narcissism',
            'reproduction',
            ['relaxation', 'stress'],
            ['experience', 'inexperience'],
            ['gratitude', 'selfishness'],
            ['optimism', 'pessimism'],
            ['intention', 'regret'],
            ['agreement', 'debate'],
            ['sanctuary', 'hell'],
            'trade'
        ]
        const choices = labels.map((choice) => {
            if (!Array.isArray(choice)) return choice
            return Math.random() < 0.5 ? choice[0] : choice[1]
        })
        const output = await classifier(prompt, choices)
        return output.labels[0]
    } catch (err) {
        console.error(err)
        // env.allowLocalModels = false
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

let isRunning = false
let isInferencing = false
export async function doInference(data, returnRouter = false) {
    try {
        if (isRunning) return
        isRunning = true
        isInferencing = true
        const { action, prompt, generatorOptions } = data

        // Get the pipeline instance. This will load and build the model when run for the first time.
        let output = await classify(prompt)
        sendMessage({
            action: 'toTopic',
            label: cleanPrediction(output)
        })

        const roll = Math.random()
        if (roll >= generatorOptions.frequency) {
            isRunning = false
            isInferencing = false
            return
        }

        // Get the pipeline instance. This will load and build the model when run for the first time.
        let generator = await InferenceSingleton.getInstance(
            generatorOptions?.model,
            (data) => {
                if (data.status === 'done') isInferencing = false
            }
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

            if (output.length > 0) {
                sendMessage({
                    status: 'partial',
                    input: output
                })
            } else if (!isInferencing) {
                shouldReturn = true
            }

            if (shouldReturn) {
                sendMessage({ status: 'complete', output })
                if (returnRouter) {
                    db.emit('toRouter', {
                        action: 'toDatabase',
                        data: output
                    })
                }
                sendMessage({ action: 'reset' })
                break
            }
        }
    } catch (error) {
        sendMessage({ status: 'error', error })
    }
    isRunning = false
    isInferencing = false
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
