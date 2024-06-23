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

// Mass accumulation parameters
const massAccumulationRate = 0.001
const maxMass = 10
const minMass = 0.25

// Monte Carlo simulation
let heads = {}
let tails = {}

const canvas = document.getElementById('slate')
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

// Get the initial center coordinates
let centerX = canvas.width / 2
let centerY = canvas.height / 2

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Ensure the canvas is styled to fit the screen
    canvas.style.width = '100%'
    canvas.style.height = '100%'

    // Update the center coordinates
    centerX = canvas.width / (2 * dpr)
    centerY = canvas.height / (2 * dpr)

    // Redraw atoms after resizing
    drawAtoms()
}

function drawAtom(x, y, z, mass) {
    const scaledRadius =
        (baseRadius * Math.sqrt(mass)) / (1 + z * scalingFactor)

    const intensity = 0.4
    const cycleSpeed = 0.23

    // Calculate color based on z value and mass
    const colorCycle = Math.sin(z * cycleSpeed)
    const blueChannel = Math.floor(255 * (intensity - intensity * colorCycle))
    const redChannel = Math.floor(255 * (intensity + intensity * colorCycle))
    const greenChannel = Math.floor(255 * (mass / maxMass)) // Add green based on mass

    // Draw the line to the center of the canvas (behind the atom)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(centerX, centerY)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Draw the atom shape (filled circle) with scaled radius and calculated color
    ctx.beginPath()
    ctx.arc(x, y, scaledRadius, 0, Math.PI * 2)
    ctx.fillStyle = `rgb(${redChannel}, ${greenChannel}, ${blueChannel})`
    ctx.fill()

    // Draw the outline of the atom
    ctx.lineWidth = 2
    ctx.strokeStyle = 'black'
    ctx.stroke()
}

function drawAtoms() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw synapse lines first (behind atoms)
    activeSynapseLines.forEach(({ atom1Index, atom2Index }) => {
        const atom1 = heads[atom1Index]
        const atom2 = heads[atom2Index]
        if (atom1 && atom2) {
            drawSynapseLine(atom1, atom2)
        }
    })

    Object.entries(heads).forEach(([i, atom]) => {
        let repulsionX = 0
        let repulsionY = 0

        Object.entries(heads).forEach(([j, otherAtom]) => {
            if (i !== j) {
                const distanceX = atom.x - otherAtom.x
                const distanceY = atom.y - otherAtom.y
                const distanceZ = atom.z - otherAtom.z
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

        const moveResult = moveAtomElastic(atom, repulsionX, repulsionY)
        atom.x = moveResult.x
        atom.y = moveResult.y

        atom.x = Math.max(
            baseRadius * Math.sqrt(atom.mass),
            Math.min(atom.x, canvas.width - baseRadius * Math.sqrt(atom.mass))
        )
        atom.y = Math.max(
            baseRadius * Math.sqrt(atom.mass),
            Math.min(atom.y, canvas.height - baseRadius * Math.sqrt(atom.mass))
        )

        // Update atom mass
        atom.mass += (Math.random() - 0.5) * 2 * massAccumulationRate
        atom.mass = Math.max(minMass, Math.min(atom.mass, maxMass))

        drawAtom(atom.x, atom.y, atom.z, atom.mass)

        if (
            Math.abs(atom.x - atom.targetX) <= tolerance &&
            Math.abs(atom.y - atom.targetY) <= tolerance
        ) {
            atom.targetX =
                Math.random() *
                    (canvas.width - baseRadius * 2 * Math.sqrt(atom.mass)) +
                baseRadius * Math.sqrt(atom.mass)
            atom.targetY =
                Math.random() *
                    (canvas.height - baseRadius * 2 * Math.sqrt(atom.mass)) +
                baseRadius * Math.sqrt(atom.mass)
        }
    })
}

function drawSynapseLine(atom1, atom2) {
    ctx.beginPath()
    ctx.moveTo(atom1.x, atom1.y)
    ctx.lineTo(atom2.x, atom2.y)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1
    ctx.stroke()
}

// Add this function at the beginning of your code
function limitSpeed(speed, maxSpeed) {
    if (speed <= maxSpeed) return speed
    const t = (speed - maxSpeed) / maxSpeed
    const limitFactor = 0.5 * (1 + Math.cos(Math.PI * Math.min(t, 1)))
    return maxSpeed + (speed - maxSpeed) * limitFactor
}

// Modify the moveAtomElastic function
function moveAtomElastic(atom, repulsionX, repulsionY) {
    const dx = (atom.targetX - atom.x) * damping + repulsionX
    const dy = (atom.targetY - atom.y) * damping + repulsionY

    // Incorporate Z-axis into motion strength
    const zFactor = 1 + Math.abs(atom.z) * 0.5

    const distance = Math.sqrt(dx * dx + dy * dy)
    const threshold = 5 * zFactor

    // Apply subtle curve to the trajectory
    const curveFactor = 0.2
    const curveX = -dy * curveFactor * silu(distance / 100)
    const curveY = dx * curveFactor * silu(distance / 100)

    const maxSpeed = 10 // Adjust this value to set the maximum speed

    if (distance < threshold) {
        const elasticFactor = (threshold - distance) / threshold
        const elasticDamping = 0.1 * zFactor
        const elasticDx = (dx + curveX) * elasticFactor * elasticDamping
        const elasticDy = (dy + curveY) * elasticFactor * elasticDamping

        atom.vx = (atom.vx || 0) * 0.9 + elasticDx
        atom.vy = (atom.vy || 0) * 0.9 + elasticDy
    } else {
        atom.vx = dx + curveX
        atom.vy = dy + curveY
    }

    // Apply speed limit
    const speed = Math.sqrt(atom.vx * atom.vx + atom.vy * atom.vy)
    const limitedSpeed = limitSpeed(speed, maxSpeed)
    const speedFactor = limitedSpeed / speed

    return {
        x: atom.x + atom.vx * speedFactor,
        y: atom.y + atom.vy * speedFactor
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
}

// Store a list of currently active synapse lines
let activeSynapseLines = []
let frameCount = 0

function animateAtoms(currentTime) {
    drawAtoms()

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
            if (
                !synapsePairs.some((p) => p[0] === pair[0] && p[1] === pair[1])
            ) {
                synapsePairs.push(pair)
            }
        }

        // Create synapse lines for the chosen pairs
        synapsePairs.forEach(([atom1Index, atom2Index]) => {
            activeSynapseLines.push({ atom1Index, atom2Index })
        })
    }

    // Request the next animation frame
    requestAnimationFrame(animateAtoms)
}

function silu(x) {
    return x * (1 / (1 + Math.exp(-x)))
}

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

function cycleAtoms() {
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
                targetX: startX,
                targetY: startY,
                mass: 1 // Initialize with base mass
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
                targetX,
                targetY,
                mass: heads[i].mass // Carry over the mass
            }
        })
    }

    tails = { ...heads }
    heads = atoms

    setTimeout(cycleAtoms, 6000)
}

let prevWindowX = window.screenX
let prevWindowY = window.screenY
let isInitialized = false

function handleWindowMove() {
    if (!isInitialized) {
        // Initialize atom positions based on the initial window position
        Object.values(heads).forEach((atom) => {
            atom.targetX = Math.random() * canvas.width
            atom.targetY = Math.random() * canvas.height
        })
        isInitialized = true
    } else {
        const deltaX = window.screenX - prevWindowX
        const deltaY = window.screenY - prevWindowY
        Object.values(heads).forEach((atom) => {
            // Calculate color based on z value
            const colorCycle = Math.sin(atom.z * 0.23)
            const blueChannel = Math.floor(255 * (0.4 - 0.4 * colorCycle))
            const redChannel = Math.floor(255 * (0.4 + 0.4 * colorCycle))

            // Check if the atom is more red than blue
            if (redChannel > blueChannel) {
                // Move the atom in the opposite direction of the cursor
                atom.targetX -= deltaX / window.devicePixelRatio
                atom.targetY -= deltaY / window.devicePixelRatio
            } else {
                // Move the atom in the same direction as the cursor
                atom.targetX += deltaX / window.devicePixelRatio
                atom.targetY += deltaY / window.devicePixelRatio
            }

            // Ensure atoms stay within the canvas boundaries
            atom.targetX = Math.max(
                baseRadius,
                Math.min(atom.targetX, canvas.width - baseRadius)
            )
            atom.targetY = Math.max(
                baseRadius,
                Math.min(atom.targetY, canvas.height - baseRadius)
            )
        })
    }

    prevWindowX = window.screenX
    prevWindowY = window.screenY

    requestAnimationFrame(handleWindowMove)
}

// Add event listeners
window.addEventListener('resize', resizeCanvas)
window.addEventListener('load', () => {
    resizeCanvas()
    animateAtoms()
    animateFieldStrength()
    cycleAtoms()
    handleWindowMove()
})

// Initial canvas resize
resizeCanvas()

function sigmoid(x) {
    return 1 / (1 + Math.exp(-10 * (x - 0.5)))
}

function* sleepTokenGenerator() {
    const baseRadius = 23
    const maxDistance = Math.sqrt(
        Math.pow(canvas.width, 2) + Math.pow(canvas.height, 2)
    )

    while (true) {
        const atomCount = Object.keys(heads).length
        if (atomCount === 0) {
            yield 0 // No atoms, score is 0
            continue
        }

        let stabilityScore = 0
        let energyScore = 0
        let distributionScore = 0
        let synergyScore = 0

        // Calculate center of mass
        let centerX = 0,
            centerY = 0
        Object.values(heads).forEach((atom) => {
            centerX += atom.x
            centerY += atom.y
        })
        centerX /= atomCount
        centerY /= atomCount

        Object.values(heads).forEach((atom, i) => {
            // Stability: how close atoms are to their target positions
            const distanceToTarget = Math.sqrt(
                Math.pow(atom.x - (atom.targetX || atom.x), 2) +
                    Math.pow(atom.y - (atom.targetY || atom.y), 2)
            )
            stabilityScore += 1 - distanceToTarget / maxDistance

            // Energy: consider z-position and velocity
            const zEnergy = Math.abs(atom.z || 0)
            const velocity = Math.sqrt(
                Math.pow(atom.vx || 0, 2) + Math.pow(atom.vy || 0, 2)
            )
            energyScore += (zEnergy + velocity) / 2

            // Distribution: reward even spacing between atoms
            let avgDistance = 0
            Object.values(heads).forEach((otherAtom, j) => {
                if (i !== j) {
                    const distance = Math.sqrt(
                        Math.pow(atom.x - otherAtom.x, 2) +
                            Math.pow(atom.y - otherAtom.y, 2)
                    )
                    avgDistance += distance
                }
            })
            avgDistance /= atomCount - 1
            distributionScore +=
                1 - Math.abs(avgDistance - 2 * baseRadius) / (2 * baseRadius)

            // Synergy: reward atoms for forming patterns or alignments
            const angleToCenter = Math.atan2(atom.y - centerY, atom.x - centerX)
            synergyScore += Math.abs(Math.sin(angleToCenter * atomCount))
        })

        // Normalize scores
        stabilityScore /= atomCount
        energyScore = Math.min(energyScore / atomCount, 1)
        distributionScore /= atomCount
        synergyScore /= atomCount

        // Calculate coverage (how much of the canvas is utilized)
        const canvasArea = canvas.width * canvas.height
        const coverage = Math.min(
            1,
            (atomCount * Math.pow(baseRadius, 2) * Math.PI) / canvasArea
        )

        // Combine all factors into a final score
        const rawScore =
            stabilityScore * 0.3 +
            energyScore * 0.2 +
            distributionScore * 0.2 +
            synergyScore * 0.2 +
            coverage * 0.1

        // Apply sigmoid function and yield the result
        yield sigmoid(rawScore)
    }
}

// Export the generator function
export default sleepTokenGenerator
