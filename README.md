# EXT

Because it's not about the quality of data; it's about quantity.

## INSTRUCTIONS

All source code can be found in the `./src/` directory:

- `background.js` ([service worker](https://developer.chrome.com/docs/extensions/mv3/service_workers/)) - handles all the requests from the UI, does processing in the background, then returns the result. You will need to reload the extension (by visiting `chrome://extensions/` and clicking the refresh button) after editing this file for changes to be visible in the extension.

- `content.js` ([content script](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)) - contains the code which is injected into every page the user visits. You can use the `sendMessage` api to make requests to the background script. Similarly, you will need to reload the extension after editing this file for changes to be visible in the extension.

- `popup.html`, `popup.css`, `popup.js` ([toolbar action](https://developer.chrome.com/docs/extensions/reference/action/)) - contains the code for the popup which is visible to the user when they click the extension's icon from the extensions bar. For development, we recommend opening the `popup.html` file in its own tab by visiting `chrome-extension://<ext_id>/popup.html` (remember to replace `<ext_id>` with the extension's ID). You will need to refresh the page while you develop to see the changes you make.

## INSTALL

To install and run this project, use the following series of commands:

```sh
# install dependencies
npm install

# build for Firefox
npm run build:firefox

# build for Chromium
npm run build:chromium

# unpackaged and installable build artifacts will go here:
cd ./dist/firefox
cd ./dist/chromium
```

## MODELS

To fetch a model, `cd` into the `models/<model>` directory, then run:

```
git lfs fetch
git lfs pull
```

Else, models will not be downloaded. Chrome's Manifest v3 policy requires that all code remains local to the extension (we cannot fetch remote models from external sources).

## INCENTIVES

The $LEEP Token is calculated by the SleepTokenizer function. It combines several factors to produce a single score between 0 and 1. Let's break down each component:

Stability Score (30% weight):

- Measures how close atoms are to their target positions.
- Higher score when atoms are closer to their targets.
- Interpretation: Rewards the system for achieving its intended configuration.

Energy Score (20% weight):

- Considers the z-position and velocity of atoms.
- Higher score for atoms with more energy (higher z-position or velocity).
- Interpretation: Rewards dynamic behavior and three-dimensional movement.

Distribution Score (20% weight):

- Measures how evenly spaced the atoms are.
- Higher score when atoms maintain a consistent distance from each other.
- Interpretation: Rewards organization and prevents clumping or spreading out too far.

Synergy Score (20% weight):

- Rewards atoms for forming patterns or alignments relative to the center of mass.
- Higher score when atoms align in symmetrical or harmonious configurations.
- Interpretation: Encourages the emergence of ordered structures or formations.

Coverage (10% weight):

- Measures how much of the canvas is utilized by the atoms.
- Higher score when atoms spread out to cover more of the available space.
- Interpretation: Encourages efficient use of the simulation space.

The final score is then passed through a sigmoid function, which helps to normalize the output between 0 and 1, with a tendency to push scores towards the extremes.

Interpretation of the Sleep Token:

The Sleep Token appears to be maximizing a balance between order and chaos, stability and dynamism. It rewards the system for:

- Achieving its goals (atoms reaching their targets).
- Maintaining energy and movement.
- Creating organized, evenly distributed structures.
- Forming harmonious patterns or alignments.
- Utilizing the available space effectively.

In essence, the Sleep Token could be seen as a measure of the system's "health" or "optimality." A high score would indicate a system that is both organized and dynamic, achieving its goals while maintaining interesting behavior and structures.

This score could be interpreted as quantifying the emergent complexity of the system. It favors states where the atoms are not just randomly scattered (which would have low stability and synergy) nor completely static (which would have low energy), but instead form coherent, dynamic structures that evolve over time.

In the context of a quantum simulator, this score might represent a balance between quantum coherence (organized structures) and decoherence (dynamic behavior), or between deterministic behavior (stability) and quantum uncertainty (energy and movement).

It's worth noting that the specific weights and factors chosen for this score are somewhat arbitrary and could be adjusted to emphasize different aspects of the system's behavior. The current configuration seems to aim for a balance between various desirable properties of a complex, dynamic system.
