import { pipeline, env } from '@xenova/transformers'
import { delay, randomBetween } from './common.js'

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1
env.allowLocalModels = true

// Use the Singleton pattern to enable lazy construction of the pipeline.
class InferenceSingleton {
    static task = 'text-generation'
    static instance = null

    static async getInstance(model, progress_callback = null) {
        model = model ? model : 'Xenova/LaMini-Neo-125M'

        if (this.instance === null) {
            this.instance = pipeline(this.task, model, {
                progress_callback
            })
        }

        return this.instance
    }
}

class ClassifierSingleton {
    static task = 'question-answering'
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

// Create generic classify function
const classify = async (context, options) => {
    let model = await ClassifierSingleton.getInstance(
        'Xenova/distilbert-base-uncased-distilled-squad'
    )

    let question =
        'In 3-5 words, what is this conversation about? What are we discussing?'

    return await model(question, context, options)
}

self.onmessage = async function (event) {
    if (event.data.action !== 'inference') return
    try {
        const { prompt, generatorOptions } = event.data

        if (generatorOptions.should_classify) {
            // Get the pipeline instance. This will load and build the model when run for the first time.
            let output = await classify(prompt, generatorOptions)
            let answer = cleanPrediction(output.answer)

            if (answer.length > 3) {
                self.postMessage({
                    action: 'classification',
                    answer,
                    score: output.score
                })
            }
        }

        if (!generatorOptions.should_infer) return

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
            await delay(randomBetween(100, 300))
            let output = ''
            for (const i in outputChars) {
                shouldReturn = true
                output += outputChars[i].char
                if (!outputChars[i].delivered) {
                    self.postMessage({
                        status: 'partial',
                        input: output
                    })
                    outputChars[i].delivered = true
                    shouldReturn = false
                    break
                }
            }
            if (shouldReturn) {
                self.postMessage({ status: 'complete', output })
                break
            }
        }
    } catch (err) {
        self.postMessage(err)
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
