import path from 'path'
import { fileURLToPath } from 'url'

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
        gun: './src/gun.js',
        atomic: './src/atomic.js',
        worker: './src/worker.js'
    },
    output: {
        path: path.resolve(__dirname, `dist/${browser}`),
        filename: '[name].js'
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
            filename: 'index.html'
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: 'public/icons',
                    to: './icons'
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
