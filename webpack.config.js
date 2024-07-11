import path from 'path'
import { fileURLToPath } from 'url'

import HtmlWebpackPlugin from 'html-webpack-plugin'
import CopyPlugin from 'copy-webpack-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const browser = process.env.NODE_ENV || 'chromium'

const config = {
    mode: 'development',
    devtool: 'source-map',
    experiments: {
        asyncWebAssembly: true
    },
    entry: {
        background: './src/background.js',
        popup: './src/popup.js',
        content: './src/content.js',
        offscreen: './src/offscreen.js',
        worker: './src/worker.js'
    },
    output: {
        path: path.resolve(__dirname, `dist/${browser}`),
        filename: '[name].js'
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/popup.html',
            filename: 'popup.html'
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: '*.js',
                    context: 'src',
                    to: '.'
                },
                {
                    from: 'public/static',
                    to: './static'
                },
                {
                    from: `public/manifest.${browser}.json`,
                    to: './manifest.json'
                },
                {
                    from: 'src/style.css',
                    to: 'style.css'
                },
                {
                    from: '*.wasm',
                    context: 'node_modules/@xenova/transformers/dist',
                    to: './ort'
                },
                {
                    from: '**/**/*.json',
                    context: 'models',
                    to: './models'
                },
                {
                    from: '**/**/*.model',
                    context: 'models',
                    to: './models'
                },
                {
                    from: '**/**/model.onnx',
                    context: 'models',
                    to: './models'
                },
                {
                    from: '**/**/decoder_model.onnx',
                    context: 'models',
                    to: './models'
                },
                {
                    from: '**/**/*merged_quantized.onnx',
                    context: 'models',
                    to: './models'
                }
            ]
        })
    ]
}

export default config
