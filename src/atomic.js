// Base radius of atoms
const baseRadius = 23
const scalingFactor = 0.01
const bias = 10

// Set up parameters for oscillation, focus
const oscillationSpeed = 0.01
const clarityBias = 0.8

// Control forces
const damping = 0.01
const tolerance = 1
const repulsionStrength = 0.1

// Monte Carlo simulation
let heads = {}
let tails = {}

const canvas = document.getElementById('void')
const ctx = canvas.getContext('2d')
canvas.classList.add('overlay')

// Adjust for high DPI displays
const dpr = window.devicePixelRatio || 1
const rect = canvas.getBoundingClientRect()
canvas.width = rect.width * dpr
canvas.height = rect.height * dpr
ctx.scale(dpr, dpr)

// Ensure the canvas is styled to fit the screen
canvas.style.width = rect.width + 'px'
canvas.style.height = rect.height + 'px'

const centerX = canvas.width / 2
const centerY = canvas.height / 2

function drawAtom(x, y, z, text) {
    const scaledRadius = baseRadius / (1 + z * scalingFactor)

    const intensity = 0.4
    const cycleSpeed = 0.23

    // Calculate color based on z value
    const colorCycle = Math.sin(z * cycleSpeed) // Sine wave for color oscillation
    const blueChannel = Math.floor(255 * (intensity - intensity * colorCycle))
    const redChannel = Math.floor(255 * (intensity + intensity * colorCycle))

    // Draw the line to the center of the canvas (behind the atom)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(centerX, centerY)
    ctx.strokeStyle = 'black'
    ctx.stroke()

    // Draw the atom shape (filled circle) with scaled radius and calculated color
    ctx.beginPath()
    ctx.arc(x, y, scaledRadius, 0, Math.PI * 2)
    ctx.fillStyle = `rgb(${redChannel}, 0, ${blueChannel})`
    ctx.fill()

    // Draw the outline of the atom
    ctx.lineWidth = 2
    ctx.strokeStyle = 'black'
    ctx.stroke()

    // Draw the text inside the atom
    ctx.font = '14px sans-serif'
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y + scaledRadius / 2)
}

function drawAtoms() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw synapse lines first (behind atoms)
    activeSynapseLines.forEach(({ atom1, atom2 }) => {
        drawSynapseLine(atom1, atom2)
    })

    Object.entries(heads).forEach(([i, value]) => {
        let repulsionX = 0
        let repulsionY = 0

        Object.entries(heads).forEach(([j, value]) => {
            if (i !== j) {
                const otherAtom = heads[j]
                const distanceX = heads[i].x - otherAtom.x
                const distanceY = heads[i].y - otherAtom.y
                const distanceZ = heads[i].z - otherAtom.z
                const distance = Math.sqrt(
                    distanceX * distanceX +
                        distanceY * distanceY +
                        distanceZ * distanceZ
                )

                const buffer = bias
                if (distance < baseRadius * 2 + buffer) {
                    const force = Math.max(
                        buffer,
                        (baseRadius * 2 - distance) / 5
                    )
                    const repulsionForce = force * damping
                    repulsionX += (repulsionForce * distanceX) / distance
                    repulsionY += (repulsionForce * distanceY) / distance
                }
            }
        })

        const moveResult = moveAtomLinear(
            heads[i].x,
            heads[i].y,
            heads[i].targetX,
            heads[i].targetY,
            damping
        )
        heads[i].x = moveResult.x + repulsionX
        heads[i].y = moveResult.y + repulsionY

        heads[i].x = Math.max(
            baseRadius,
            Math.min(heads[i].x, canvas.width - baseRadius)
        )
        heads[i].y = Math.max(
            baseRadius,
            Math.min(heads[i].y, canvas.height - baseRadius)
        )

        drawAtom(heads[i].x, heads[i].y, heads[i].z, heads[i].text)

        if (
            Math.abs(heads[i].x - heads[i].targetX) <= tolerance &&
            Math.abs(heads[i].y - heads[i].targetY) <= tolerance
        ) {
            heads[i].targetX =
                Math.random() * (canvas.width - baseRadius * 2) + baseRadius
            heads[i].targetY =
                Math.random() * (canvas.height - baseRadius * 2) + baseRadius
        }
    })
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms))

function drawSynapseLine(atom1, atom2) {
    // Extract coordinates directly from atom objects
    const x1 = atom1.x
    const y1 = atom1.y
    const x2 = atom2.x
    const y2 = atom2.y

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1
    ctx.stroke()
}

function moveAtomLinear(old_x, old_y, new_x, new_y, damping) {
    const dx = (new_x - old_x) * damping
    const dy = (new_y - old_y) * damping

    const updated_x = old_x + dx
    const updated_y = old_y + dy

    return { x: updated_x, y: updated_y }
}

function getRandomInt(min, max) {
    // Ensure min is smaller than max
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
}

// Store a list of currently active synapse lines
let activeSynapseLines = []
let synapseLines = []
let frameCount = 0

function animateAtoms() {
    requestAnimationFrame(animateAtoms)
    drawAtoms()

    // Draw active synapse lines
    activeSynapseLines.forEach(({ atom1, atom2 }) => {
        // Determine which atom should be drawn "closer"
        const closerAtom = atom1.z > atom2.z ? atom1 : atom2
        const fartherAtom = atom1 === closerAtom ? atom2 : atom1

        // Draw the farther atom first
        drawAtom(fartherAtom.x, fartherAtom.y, fartherAtom.z, fartherAtom.text)

        // Draw the connecting line
        drawSynapseLine(atom1, atom2)

        // Draw the closer atom to appear in front of the line
        drawAtom(closerAtom.x, closerAtom.y, closerAtom.z, closerAtom.text)
    })

    frameCount++

    // Rotate synapse connections every few seconds
    const roll = getRandomInt(6, 66)
    if (frameCount % roll === 0) {
        activeSynapseLines = [] // Clear existing synapse lines

        // Choose a random number of synapse pairs (2-4)
        const numSynapses = Math.floor(Math.random() * 3) + 2

        // Generate unique synapse pairs
        const synapsePairs = []
        while (synapsePairs.length < numSynapses) {
            const atom1Index = Math.floor(
                Math.random() * Object.keys(heads).length
            )
            const atom2Index = Math.floor(
                Math.random() * Object.keys(heads).length
            )

            const pair = [atom1Index, atom2Index].sort() // Ensure order doesn't matter
            if (!synapsePairs.includes(pair)) {
                synapsePairs.push(pair)
            }
        }

        // Create synapse lines for the chosen pairs
        synapsePairs.forEach(([atom1Index, atom2Index]) => {
            const atom1 = heads[atom1Index]
            const atom2 = heads[atom2Index]

            activeSynapseLines.push({ atom1, atom2 })
            drawSynapseLine(atom1, atom2) // Pass atom objects
        })
    }
}

// Function to calculate the SILU (Sigmoid-weighted Linear Unit) function
function silu(x) {
    return x * (1 / (1 + Math.exp(-x)))
}

// Animation loop
function animateFieldStrength() {
    const currentTime = new Date().getTime()
    const oscillationValue = Math.sin(currentTime * oscillationSpeed)

    // Calculate the SILU-weighted blur strength
    const blurStrength =
        silu(oscillationValue) * (5.0 - 0.1) + 0.1 * clarityBias

    // Apply the calculated blur strength to the canvas
    canvas.style.filter = `blur(${blurStrength}px)`

    // Request the next animation frame
    requestAnimationFrame(animateFieldStrength)
}

// Start the animation loop
animateFieldStrength()

async function cycleAtoms() {
    const atoms = {}

    if (Object.keys(heads).length === 0) {
        for (let i = 0; i < 9; i++) {
            const startX =
                Math.random() * (canvas.width - baseRadius * 2) + baseRadius
            const startY =
                Math.random() * (canvas.height - baseRadius * 2) + baseRadius
            const startZ = Math.random() - 0.5
            atoms[i] = {
                x: startX,
                y: startY,
                z: startZ,
                text: `${i}.`,
                targetX: startX,
                targetY: startY
            }
        }
    } else {
        Object.entries(heads).forEach(([i, value]) => {
            const targetX = heads[i].x + Math.random() * 100 - 50
            const targetY = heads[i].y + Math.random() * 100 - 50
            const targetZ = heads[i].z + Math.random() * 2 - 1 // Adjust the range for more noticeable z movement

            atoms[i] = {
                x: heads[i].x,
                y: heads[i].y,
                z: targetZ,
                text: `${i}.`,
                targetX,
                targetY
            }
        })
    }

    tails = { ...heads }
    heads = atoms

    Object.entries(heads).forEach(([i, value]) => {
        let repulsionX = 0
        let repulsionY = 0

        Object.entries(heads).forEach(([j, value]) => {
            if (i !== j) {
                const otherAtom = heads[j]
                const distanceX = heads[i].x - otherAtom.x
                const distanceY = heads[i].y - otherAtom.y
                const distanceZ = heads[i].z - otherAtom.z
                const distance = Math.sqrt(
                    distanceX * distanceX +
                        distanceY * distanceY +
                        distanceZ * distanceZ
                )

                const buffer = bias
                if (distance < baseRadius * 2 + buffer) {
                    const force = Math.max(
                        buffer,
                        (baseRadius * 2 - distance) / 5
                    )
                    const repulsionForce = force * repulsionStrength
                    repulsionX += (repulsionForce * distanceX) / distance
                    repulsionY += (repulsionForce * distanceY) / distance
                }
            }
        })

        const moveResult = moveAtomLinear(
            heads[i].x,
            heads[i].y,
            heads[i].targetX,
            heads[i].targetY,
            damping
        )
        heads[i].x = moveResult.x + repulsionX
        heads[i].y = moveResult.y + repulsionY

        heads[i].x = Math.max(
            baseRadius,
            Math.min(heads[i].x, canvas.width - baseRadius)
        )
        heads[i].y = Math.max(
            baseRadius,
            Math.min(heads[i].y, canvas.height - baseRadius)
        )

        drawAtom(heads[i].x, heads[i].y, heads[i].z, heads[i].text)

        if (
            Math.abs(heads[i].x - heads[i].targetX) <= tolerance &&
            Math.abs(heads[i].y - heads[i].targetY) <= tolerance
        ) {
            heads[i].targetX =
                Math.random() * (canvas.width - baseRadius * 2) + baseRadius
            heads[i].targetY =
                Math.random() * (canvas.height - baseRadius * 2) + baseRadius
        }
    })

    await delay(6000)
    await cycleAtoms()
}

animateAtoms()
cycleAtoms()

// Function to generate a random number within a range
function getRandomInRange(min, max) {
    return Math.random() * (max - min) + min
}
