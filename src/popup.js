// popup.js - handles interaction with the extension's popup, sends requests to the
// service worker (background.js), and updates the popup's UI (popup.html) on completion.

import Gun from './gun.js'

const inputElement = document.getElementById('input')
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

// Listen for changes made to the textbox.
// inputElement.addEventListener('input', (event) => {
inputElement.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return

    // Bundle the input data into a message.
    const message = {
        action: 'update',
        text: event.target.value
    }

    gun.send(message.text)
    event.target.value = ''

    // Send this message to the service worker.
    // chrome.runtime.sendMessage(message, (response) => {
    //     // Handle results returned by the service worker (`background.js`) and update the popup's UI.
    //     outputElement.innerText = JSON.stringify(response, null, 2)
    // })

    // focus.send(message.text)
})

const persistButton = document.getElementById('persist')

persistButton.addEventListener('click', () => {
    chrome.windows.create({
        url: 'index.html',
        type: 'popup',
        focused: true,
        width: 400,
        height: 500
    })
})
