import path from 'path'
import { fileURLToPath } from 'url'

import webpack from 'webpack'
import TerserPlugin from 'terser-webpack-plugin'
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
        worker: './src/worker.js'
    },
    output: {
        path: path.resolve(__dirname, `dist/${browser}`),
        filename: '[name].js'
    },
    // optimization: {
    //     usedExports: true,
    //     minimize: true,
    //     minimizer: [
    //         new TerserPlugin({
    //             terserOptions: {
    //                 compress: {
    //                     drop_console: true,
    //                     dead_code: true,
    //                     conditionals: true,
    //                     evaluate: true,
    //                     booleans: true,
    //                     loops: true,
    //                     unused: true,
    //                     hoist_funs: true,
    //                     keep_fargs: false,
    //                     hoist_vars: true,
    //                     if_return: true,
    //                     join_vars: true,
    //                     // cascade: true,
    //                     side_effects: true,
    //                     warnings: false
    //                 }
    //             }
    //         })
    //     ]
    // },
    // optimization: {
    //     usedExports: true,
    //     minimize: true,
    //     minimizer: [
    //         new TerserPlugin({
    //             terserOptions: {
    //                 compress: {
    //                     drop_console: true
    //                 }
    //             }
    //         })
    //     ],
    //     splitChunks: {
    //         chunks: 'all', // Changed from 'async' to 'all'
    //         maxSize: 2000000, // 2MB in bytes
    //         minSize: 20000, // 20KB in bytes
    //         enforceSizeThreshold: 50000, // 50KB in bytes
    //         cacheGroups: {
    //             defaultVendors: {
    //                 test: /[\\/]node_modules[\\/]/,
    //                 priority: -10,
    //                 reuseExistingChunk: true
    //             },
    //             default: {
    //                 minChunks: 2,
    //                 priority: -20,
    //                 reuseExistingChunk: true
    //             }
    //         }
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
