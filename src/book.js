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
            // register itself to the browser's foreground context - rather
            // than the background (service worker) context.
            WebSocket: self.WebSocket,
            crypto: self.crypto,
            TextEncoder: self.TextEncoder,
            TextDecoder: self.TextDecoder
        })
    }

    subscribe(focus) {
        this.focus = this.gun.get('src').get('bullets').get(focus)
        return this.focus
    }

    send(message) {
        this.focus.put(
            JSON.stringify({
                identifier: 'GhostIsCuteVoidGirl',
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

export default Controller
