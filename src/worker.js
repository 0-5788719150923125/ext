import { pipeline, env } from '@xenova/transformers'

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1
env.allowLocalModels = false

// Use the Singleton pattern to enable lazy construction of the pipeline.
class InferenceSingleton {
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

class ClassifierSingleton {
    static task = 'question-answering'
    // static model = 'Xenova/pythia-14m'
    static model = 'Xenova/distilbert-base-uncased-distilled-squad'
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
const classify = async (context, options) => {
    // Get the pipeline instance. This will load and build the model when run for the first time.
    let model = await ClassifierSingleton.getInstance((data) => {
        // You can track the progress of the pipeline creation here.
        // e.g., you can send `data` back to the UI to indicate a progress bar
        // console.log('progress', data)
    })

    // Actually run the model on the input text
    let question = 'What is this conversation about?'
    let result = await model(question, context, options)

    return result
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms))

let tokenCount = 0
let isRunning = false
let lastTokenTime = 0

self.onmessage = async function (event) {
    if (isRunning) return
    if (event.data.action !== 'inference') return
    isRunning = true
    try {
        const { prompt, generatorOptions } = event.data

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

        // Get the pipeline instance. This will load and build the model when run for the first time.
        let generator = await InferenceSingleton.getInstance((data) => {
            // You can track the progress of the pipeline creation here.
            // e.g., you can send `data` back to the UI to indicate a progress bar
            self.postMessage(data)
        })

        // Reset the token count and last token time for each new inference
        tokenCount = 0
        lastTokenTime = Date.now()

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
                const cleanedPartial = cleanPrediction(partial, prompt)
                if (cleanedPartial.length > 2) {
                    tokenCount++
                    const delay = tokenCount * 333
                    setTimeout(() => {
                        self.postMessage({
                            status: 'partial',
                            input: cleanedPartial + '//:fold'
                        })
                        lastTokenTime = Date.now()
                    }, delay)
                }
            }
        })

        // Wait until there are no more tokens generated within 3000 ms
        while (Date.now() - lastTokenTime < 3000) {
            await delay(1000)
        }

        const pred = result[0].generated_text
        const clean = cleanPrediction(pred, prompt)
        if (clean.length > 2) {
            self.postMessage({ status: 'complete', output: clean })
        }
    } catch (err) {
        self.postMessage(err)
    }
    self.postMessage({ action: 'cleanup' })
    isRunning = false
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
