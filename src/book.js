import Gun from 'gun'
// // import SEA from 'gun/sea.js'
import 'gun/lib/radix.js'
import 'gun/lib/radisk.js'
import 'gun/lib/store.js'
import 'gun/lib/rindexed.js'
import 'gun/lib/webrtc.js'
import 'gun/lib/yson.js'
import 'gun/lib/open.js'

class Controller {
    constructor() {
        this.gun = Gun({
            peers: ['wss://59.src.eco/gun', 'wss://95.src.eco/gun'],
            file: 'gun',
            localStorage: false,
            radisk: false,
            axe: false,
            // We have to pass the necessary APIs to GUN, else GUN will
            // register itself to the browser's foreground - rather
            // than the background (service worker) context.
            WebSocket: self.WebSocket,
            crypto: self.crypto,
            TextEncoder: self.TextEncoder,
            TextDecoder: self.TextDecoder
        })
        this.identifier = getRandomIdentifier()
    }

    subscribe(focus) {
        this.focus = this.gun.get('src').get('bullets').get(focus)
        return this.focus
    }

    send(message) {
        this.focus.put(
            JSON.stringify({
                identifier: this.identifier,
                message,
                pubKey: null
            }),
            function (ack) {
                if (!ack.ok) {
                    console.error(ack)
                }
            }
        )
    }
}

export function getRandomIdentifier() {
    const length = Math.random() < 0.5 ? 18 : 19

    let randomNumber = (Math.floor(Math.random() * 9) + 1).toString()
    while (randomNumber.length < length) {
        randomNumber = randomNumber + Math.floor(Math.random() * 10).toString()
    }
    return randomNumber
}

export default Controller
