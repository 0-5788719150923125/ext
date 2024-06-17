// content.js - the content scripts which is run in the context of web pages, and has access
// to the DOM and other web APIs.

import Gun from './core.js'

const outputElement = document.getElementById('output')

const gun = new Gun()
const focus = gun.subscribe('trade')
focus.on(async (node) => {
    if (typeof node === 'undefined' || typeof node === 'null') return
    const message = {
        action: 'update',
        text: JSON.parse(node).message
    }
    chrome.runtime.sendMessage(message, (response) => {
        outputElement.innerText = message.text
    })
})
