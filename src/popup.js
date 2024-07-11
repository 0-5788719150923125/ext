// popup.js - handles interaction with the extension's popup, sends requests to the
// service worker (background.js), and updates the popup's UI (popup.html) on completion.

import SleepTokenizer from './simulator.js'

const inputElement = document.getElementById('input')
const outputElement = document.getElementById('output')
const topicElement = document.getElementById('topic')
const trainLink = document.getElementById('trainLink')
const tokenLink = document.getElementById('sleepToken')

// Function to update the URL with a new word
function updateTrainLink(word) {
    trainLink.href = `https://src.eco/?focus=${word}`
}

// Generic functions used to update the UI
function updateOutputUI(string) {
    outputElement.textContent = string
    outputElement.style.color = 'black'
}

function updateInputUI(string) {
    inputElement.value = string
}

function updateTopicUI(string) {
    if (string.length < 2) return
    if (string.length > 60) {
        string = string.slice(0, 60) + '...'
    }
    topicElement.textContent = string.toUpperCase()
    updateTrainLink(string.slice(0, 256))
}

function updateErrorUI(string) {
    outputElement.textContent = string
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
            // if (isUserTyping()) break
            updateInputUI(data)
            break
        case 'floatRight':
            if (isUserTyping()) break
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
        action: 'fromUser',
        data: event.target.value
    }

    chrome.runtime.sendMessage(message)
    updateOutputUI(message.data)
    event.target.value = ''
    event.target.blur()
})

// Pin the popup window
const persistButton = document.getElementById('persist')
persistButton.addEventListener('click', () => {
    chrome.windows.create({
        url: 'popup.html',
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
        // { value: 'Xenova/OpenELM-270M-Instruct', label: 'Apple/OpenELM-270M' }, // unsupported
        { value: 'Xenova/opt-350m', label: 'Meta/opt-350m' },
        { value: 'Xenova/pythia-70m-deduped', label: 'Xenova/pythia-70m' },
        { value: 'Xenova/gpt2', label: 'OpenAI/gpt2' },
        {
            value: 'Xenova/LaMini-Cerebras-256M',
            label: 'LaMini/Cerebras-256M'
        }
        // {
        //     value: 'Xenova/Qwen1.5-0.5B-Chat',
        //     label: 'Alibaba/Qwen1.5-0.5B'
        // }
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

// Retrieve the temperature value from storage
chrome.storage.local.get('temperature', (data) => {
    let defaultTemperature = '0.5'
    if (data.temperature) {
        defaultTemperature = data.temperature
    }
    chrome.storage.local.set({ temperature: defaultTemperature })
    setupTemperatureSlider(defaultTemperature)
})

function setupTemperatureSlider(defaultTemperature) {
    const temperatureButton = document.getElementById('temperature')
    const sliderContainer = document.getElementById(
        'temperature-slider-container'
    )
    const slider = document.getElementById('temperature-slider')
    const valueDisplay = document.getElementById('temperature-value')

    // Set initial value
    slider.value = defaultTemperature
    valueDisplay.textContent = defaultTemperature

    // Toggle the slider container visibility when the temperature button is clicked
    temperatureButton.addEventListener('click', (event) => {
        event.stopPropagation() // Prevent the click from immediately closing the slider
        sliderContainer.style.display =
            sliderContainer.style.display === 'flex' ? 'none' : 'flex'
    })

    // Update the value display and save to storage when the slider changes
    slider.addEventListener('input', () => {
        const value = parseFloat(slider.value).toFixed(2)
        tokenizer.updateTemperature(value)
        valueDisplay.textContent = value
        chrome.storage.local.set({ temperature: value })
    })
}

// Close the slider when clicking outside
document.addEventListener('click', (event) => {
    const temperatureButton = document.getElementById('temperature')
    const sliderContainer = document.getElementById(
        'temperature-slider-container'
    )

    if (!temperatureButton.contains(event.target)) {
        sliderContainer.style.display = 'none'
    }
})

// Global variable to track input focus
let isInputFocused = false

document.addEventListener('DOMContentLoaded', () => {
    const inputElement = document.getElementById('input')

    // Set focus flag to true when input gains focus
    inputElement.addEventListener('focus', () => {
        isInputFocused = true
    })

    // Set focus flag to false when input loses focus
    inputElement.addEventListener('blur', () => {
        isInputFocused = false
    })
})

function isUserTyping() {
    return isInputFocused
}

const tokenizer = SleepTokenizer
const tokenGenerator = tokenizer.generator()

let currentSleepScore = 0
let targetSleepScore = 0
let transitionProgress = 0

function getLatestSleepTokens() {
    return tokenGenerator.next().value
}

function updateSleepScore() {
    currentSleepScore = targetSleepScore
    targetSleepScore = getLatestSleepTokens()
    transitionProgress = 0
}

function interpolateSleepScore() {
    if (transitionProgress >= 1) {
        return targetSleepScore
    }
    return (
        currentSleepScore +
        (targetSleepScore - currentSleepScore) * transitionProgress
    )
}

function updateDisplay(interpolatedScore) {
    tokenLink.textContent = '$LEEP: ' + interpolatedScore.toFixed(4)
}

let frame = 0
function animationLoop() {
    frame++

    if (frame % 60 === 0) {
        updateSleepScore()
        frame = 0
    }

    transitionProgress = (frame % 60) / 60
    const interpolatedScore = interpolateSleepScore()
    updateDisplay(interpolatedScore)

    requestAnimationFrame(animationLoop)
}

// Initialize the first score
updateSleepScore()

animationLoop()
