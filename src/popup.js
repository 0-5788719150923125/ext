// popup.js - handles interaction with the extension's popup, sends requests to the
// service worker (background.js), and updates the popup's UI (index.html) on completion.

const inputElement = document.getElementById('input')
const outputElement = document.getElementById('output')

chrome.runtime.sendMessage({ action: 'bootstrap' })

// Listen for messages from background workers
const backgroundPort = chrome.runtime.connect({ name: 'foreground' })
backgroundPort.onMessage.addListener((message) => {
    if (message.type === 'toOutputField') {
        const data = message.data
        updateOutputUI(data)
    } else if (message.type === 'toInputField') {
        const data = message.data
        updateInputUI(data)
    } else if (message.type === 'resetInput') {
        inputElement.classList.remove('right-align')
    }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'toOutputField') {
        const data = message.data
        updateOutputUI(data)
    } else if (message.type === 'toInputField') {
        const data = message.data
        updateInputUI(data)
    } else if (message.type === 'resetInput') {
        inputElement.classList.remove('right-align')
    }
})

// Listen for changes made to the input box.
inputElement.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return

    // Bundle the input data into a message.
    const message = {
        action: 'send',
        text: event.target.value
    }

    // Send this message to the service worker.
    chrome.runtime.sendMessage(message)

    // Clear the input
    event.target.value = ''

    updateOutputUI(message.text)
})

// Generic functions used to update the UI
function updateOutputUI(string) {
    outputElement.innerText = string
}

function updateInputUI(string) {
    inputElement.classList.add('right-align')
    inputElement.value = string
}

// Pin the popup window
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

function isChromiumBased() {
    const userAgent = navigator.userAgent.toLowerCase()
    return userAgent.includes('chrome') || userAgent.includes('chromium')
}

function getRandomScreenPosition() {
    const screenWidth = window.screen.availWidth
    const screenHeight = window.screen.availHeight
    const windowWidth = 400
    const windowHeight = 500
    const maxLeft = screenWidth - windowWidth
    const maxTop = screenHeight - windowHeight

    const left = Math.floor(Math.random() * maxLeft)
    const top = Math.floor(Math.random() * maxTop)

    return { left, top }
}

const desiredWindowCount = 3

if (isChromiumBased()) {
    chrome.windows.getAll({ populate: true }, (windows) => {
        const extensionWindows = windows.filter((window) =>
            window.tabs.some((tab) => tab.url.includes('chrome-extension://'))
        )

        const windowsToOpen = desiredWindowCount - extensionWindows.length

        if (windowsToOpen > 0) {
            for (let i = 0; i < windowsToOpen; i++) {
                const { left, top } = getRandomScreenPosition()
                chrome.windows.create({
                    url: 'index.html',
                    type: 'popup',
                    focused: true,
                    width: 400,
                    height: 500,
                    left,
                    top
                })
            }
        }
    })
}
