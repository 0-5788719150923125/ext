// popup.js - handles interaction with the extension's popup, sends requests to the
// service worker (background.js), and updates the popup's UI (index.html) on completion.

const inputElement = document.getElementById('input')
const outputElement = document.getElementById('output')
const topicElement = document.getElementById('topic')
const trainLink = document.getElementById('trainLink')

// Function to update the URL with a new word
function updateTrainLink(word) {
    trainLink.href = `https://src.eco/?focus=${word}`
}

// Generic functions used to update the UI
function updateOutputUI(string) {
    outputElement.innerText = string
    outputElement.style.color = 'black'
}

function updateInputUI(string) {
    inputElement.value = string
}

function updateTopicUI(string) {
    topicElement.innerText = string
    updateTrainLink(string.slice(0, 256))
}

function updateErrorUI(string) {
    outputElement.innerText = string
    outputElement.style.color = 'red'
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
        case 'toErrorField':
            updateErrorUI(data)
            break
    }
})

// Listen for changes made to the input box.
inputElement.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return

    const message = {
        action: 'toDatabase',
        data: event.target.value
    }

    chrome.runtime.sendMessage(message)
    updateOutputUI(message.data)
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

// Retrieve the frequency option from storage
chrome.storage.local.get('frequency', (data) => {
    let defaultFrequency = '0.1'
    if (data.frequency) {
        defaultFrequency = data.frequency
    }
    chrome.storage.local.set({ frequency: defaultFrequency })
    displayFrequencyOptions(defaultFrequency)
})

function displayFrequencyOptions(currentFrequency) {
    // Get the selection button element
    const frequencyToggle = document.getElementById('frequency')

    // Create the selection box element
    const selectionBox = document.createElement('div')
    selectionBox.id = 'selection-box frequency'
    selectionBox.className = 'selection-box frequency'

    // Create the radio button options
    const options = [
        { value: '1.0', label: '100%' },
        { value: '0.5', label: '50%' },
        { value: '0.1', label: '10%' }
    ]

    options.forEach((option) => {
        const label = document.createElement('label')
        const radio = document.createElement('input')
        radio.type = 'radio'
        radio.name = 'frequency'
        radio.value = option.value

        if (currentFrequency === option.value) {
            radio.checked = true
        }

        label.appendChild(radio)
        label.appendChild(document.createTextNode(` ${option.label}`))
        selectionBox.appendChild(label)
    })

    // Append the selection box to the selection button
    frequencyToggle.appendChild(selectionBox)

    // Toggle the selection box visibility when the selection button is clicked
    frequencyToggle.addEventListener('click', () => {
        selectionBox.style.display =
            selectionBox.style.display === 'block' ? 'none' : 'block'
    })

    // Handle the selection change event
    selectionBox.addEventListener('change', (event) => {
        const frequency = event.target.value
        chrome.storage.local.set({ frequency })
    })
}

// Retrieve the model option from storage
chrome.storage.local.get('model', (data) => {
    let defaultModel = 'Xenova/LaMini-Neo-125M'
    if (data.model) {
        defaultModel = data.model
    }
    chrome.storage.local.set({ model: defaultModel })
    displayModelOptions(defaultModel)
})

function displayModelOptions(currentModel) {
    // Get the selection button element
    const modelToggle = document.getElementById('models')

    // Create the selection box element
    const selectionBox = document.createElement('div')
    selectionBox.id = 'selection-box models'
    selectionBox.className = 'selection-box models'

    // Create the radio button options
    const options = [
        { value: 'Xenova/LaMini-Neo-125M', label: 'EleutherAI/GPT-Neo-125M' },
        // { value: 'Xenova/OpenELM-270M-Instruct', label: 'Apple/OpenELM-270M' }, // unsupported?
        { value: 'Xenova/opt-350m', label: 'Meta/opt-350m' },
        { value: 'Xenova/pythia-70m', label: 'Xenova/pythia-70m' },
        { value: 'Xenova/gpt2', label: 'OpenAI/gpt2' },
        {
            value: 'Xenova/LaMini-Cerebras-256M',
            label: 'LaMini/Cerebras-256M'
        }
    ]

    options.forEach((option) => {
        const label = document.createElement('label')
        const radio = document.createElement('input')
        radio.type = 'radio'
        radio.name = 'model'
        radio.value = option.value

        if (currentModel === option.value) {
            radio.checked = true
        }

        label.appendChild(radio)
        label.appendChild(document.createTextNode(` ${option.label}`))
        selectionBox.appendChild(label)
    })

    // Append the selection box to the selection button
    modelToggle.appendChild(selectionBox)

    // Toggle the selection box visibility when the selection button is clicked
    modelToggle.addEventListener('click', () => {
        selectionBox.style.display =
            selectionBox.style.display === 'block' ? 'none' : 'block'
    })

    // Handle the selection change event
    selectionBox.addEventListener('change', (event) => {
        const model = event.target.value
        chrome.storage.local.set({ model: model })
    })
}

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

// Manifest v3 forces us to open 3 windows, such that WebRTC will connect between them.
// This will force Chromium to allow the output connections, and connect to GUN.
// Opening a single instance will NEVER connect to GUN on v3.
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
