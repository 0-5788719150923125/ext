// popup.js - handles interaction with the extension's popup, sends requests to the
// service worker (background.js), and updates the popup's UI (index.html) on completion.

const inputElement = document.getElementById('input')
const outputElement = document.getElementById('output')
const topicElement = document.getElementById('topic')

// Generic functions used to update the UI
function updateOutputUI(string) {
    outputElement.innerText = string
}

function updateInputUI(string) {
    inputElement.value = string
}

function updateTopicUI(string) {
    topicElement.innerText = string
}

// Listen for messages from background workers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const data = message.data
    switch (message.action) {
        case 'toOutputField':
            updateOutputUI(data)
            break
        case 'toInputField':
            updateInputUI(data)
            break
        case 'floatRight':
            inputElement.classList.add('right-align')
            break
        case 'floatLeft':
            inputElement.classList.remove('right-align')
            break
        case 'toTopic':
            updateTopicUI(data)
            break
        default:
            console.log(message)
    }
})

// Listen for changes made to the input box.
inputElement.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return

    const message = {
        action: 'toDatabase',
        text: event.target.value
    }

    chrome.runtime.sendMessage(message)
    updateOutputUI(message.text)
    event.target.value = ''
})

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

const desiredWindowCount = 2

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
