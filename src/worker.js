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

const delay = (ms) => new Promise((res) => setTimeout(res, ms))

let tokenCount = 0
let isRunning = false

self.onmessage = async function (event) {
    if (isRunning) return
    if (event.data.action !== 'inference') return
    isRunning = true
    try {
        // Get the pipeline instance. This will load and build the model when run for the first time.
        let generator = await PipelineSingleton.getInstance((data) => {
            // You can track the progress of the pipeline creation here.
            // e.g., you can send `data` back to the UI to indicate a progress bar
            self.postMessage(data)
        })

        const { prompt, generatorOptions } = event.data

        // Reset the token count for each new inference
        tokenCount = 0
        let accumulatedDelay = 0

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
                if (cleanedPartial.length > 3) {
                    tokenCount++
                    const delay = tokenCount * 333
                    accumulatedDelay += delay
                    setTimeout(() => {
                        self.postMessage({
                            status: 'partial',
                            input: cleanedPartial + '//:fold'
                        })
                    }, delay)
                }
            }
        })

        await delay(11000)
        const pred = result[0].generated_text
        const clean = cleanPrediction(prompt, pred)
        if (clean.length > 3) {
            self.postMessage({ status: 'complete', output: clean })
        }

        let i = 0
        while (i < 5) {
            self.postMessage({ action: 'cleanup' })
            await delay(3000)
            i++
        }
    } catch (err) {
        console.error(err)
        self.postMessage(err)
        self.postMessage({ action: 'cleanup' })
    }
    isRunning = false
}

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
