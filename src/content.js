// content.js - the content scripts which is run in the context of web pages, and has access
// to the DOM and other web APIs.

// Example usage:
// const message = {
//     action: 'classify',
//     text: 'text to classify',
// }
// chrome.runtime.sendMessage(message, (response) => {
//     console.log('received user data', response)
// });

import Gun from './core.js'

const outputElement = document.getElementById('output')

console.log('running content scripts')

const gun = new Gun()
const focus = gun.subscribe('trade')
focus.on(async (node) => {
    if (typeof node === 'undefined' || typeof node === 'null') return
    console.log(node)
    const message = {
        action: 'classify',
        text: JSON.parse(node).message
    }
    chrome.runtime.sendMessage(message, (response) => {
        console.log('received user data', response)
        outputElement.innerText = JSON.stringify(message, null, 2)
    })
})
