import path from 'path'
import { fileURLToPath } from 'url'

import HtmlWebpackPlugin from 'html-webpack-plugin'
import CopyPlugin from 'copy-webpack-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const config = {
    mode: 'development',
    devtool: 'inline-source-map',
    entry: {
        background: './src/background.js',
        popup: './src/popup.js',
        content: './src/content.js',
        core: './src/core.js'
    },
    output: {
        path: path.resolve(__dirname, 'build'),
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
                    from: 'public',
                    to: '.' // Copies to build folder
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
