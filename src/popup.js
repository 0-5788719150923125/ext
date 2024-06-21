// popup.js - handles interaction with the extension's popup, sends requests to the
// service worker (background.js), and updates the popup's UI (index.html) on completion.

import SleepTokenizer from './simulator.js'

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
    const options = [
        { value: '1.0', label: '100%' },
        { value: '0.5', label: '50%' },
        { value: '0.1', label: '10%' }
    ]

    let defaultFrequency = '0.1'
    if (data.frequency) {
        defaultFrequency = data.frequency
    }
    chrome.storage.local.set({ frequency: defaultFrequency })
    displayOptionsToggle('frequency', options, defaultFrequency)
})

// Retrieve the model option from storage
chrome.storage.local.get('model', (data) => {
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

    let defaultModel = 'Xenova/LaMini-Neo-125M'
    if (data.model) {
        defaultModel = data.model
    }
    chrome.storage.local.set({ model: defaultModel })
    displayOptionsToggle('model', options, defaultModel)
})

function displayOptionsToggle(elementId, options, currentValue) {
    // Get the selection button element
    const toggle = document.getElementById(elementId)

    // Create the selection box element
    const selectionBox = document.createElement('div')
    selectionBox.id = `selection-box ${elementId}`
    selectionBox.className = `selection-box ${elementId}`

    options.forEach((option) => {
        const label = document.createElement('label')
        const radio = document.createElement('input')
        radio.type = 'radio'
        radio.name = elementId
        radio.value = option.value

        if (currentValue === option.value) {
            radio.checked = true
        }

        label.appendChild(radio)
        label.appendChild(document.createTextNode(` ${option.label}`))
        selectionBox.appendChild(label)
    })

    // Append the selection box to the selection button
    toggle.appendChild(selectionBox)

    // Toggle the selection box visibility when the selection button is clicked
    toggle.addEventListener('click', () => {
        selectionBox.style.display =
            selectionBox.style.display === 'block' ? 'none' : 'block'
    })

    // Handle the selection change event
    selectionBox.addEventListener('change', (event) => {
        chrome.storage.local.set({ [elementId]: event.target.value })
    })
}

const tokenGenerator = SleepTokenizer()

function getLatestSleepTokens() {
    return tokenGenerator.next().value
}

function updateSleepScore() {
    const leepScore = getLatestSleepTokens()
    document.getElementById('sleepToken').textContent =
        '$LEEP: ' + leepScore.toFixed(4)
}

function animationLoop() {
    updateSleepScore()
    requestAnimationFrame(animationLoop)
}

animationLoop()
