// popup.js - handles interaction with the extension's popup, sends requests to the
// service worker (background.js), and updates the popup's UI (popup.html) on completion.

const inputElement = document.getElementById('text')
const outputElement = document.getElementById('output')

// Listen for changes made to the textbox.
inputElement.addEventListener('input', (event) => {
    // Bundle the input data into a message.
    const message = {
        action: 'update',
        text: event.target.value
    }

    // Send this message to the service worker.
    chrome.runtime.sendMessage(message, (response) => {
        // Handle results returned by the service worker (`background.js`) and update the popup's UI.
        outputElement.innerText = JSON.stringify(response, null, 2)
    })
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
