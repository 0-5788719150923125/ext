import path from 'path'
import { fileURLToPath } from 'url'

import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import CopyPlugin from 'copy-webpack-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const browser = process.env.NODE_ENV || 'chromium'

const config = {
    mode: 'development',
    devtool: 'inline-source-map',
    entry: {
        background: './src/background.js',
        popup: './src/popup.js',
        content: './src/content.js',
        offscreen: './src/offscreen.js',
        worker: './src/worker.js',
        book: './src/book.js'
    },
    output: {
        path: path.resolve(__dirname, `dist/${browser}`),
        filename: '[name].js'
    },
    // optimization: {
    //     splitChunks: {
    //         // chunks: 'all',
    //         chunks(chunk) {
    //             return chunk.name !== 'background'
    //         },
    //         maxSize: 1000000 // 1MB in bytes
    //     }
    // },
    // resolve: {
    //     fallback: {
    //         fs: false,
    //         path: false,
    //         crypto: false
    //     }
    // },
    plugins: [
        // new webpack.optimize.LimitChunkCountPlugin({
        //     maxChunks: 50
        // }),
        // new webpack.IgnorePlugin({
        //     resourceRegExp: /onnxruntime-node/
        // }),
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
                }
            ]
        })
    ]
}

export default config
