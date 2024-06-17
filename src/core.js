import Gun from 'gun'
// import SEA from 'gun/sea.js'
// import 'gun/lib/radix.js'
// import 'gun/lib/radisk.js'
// import 'gun/lib/store.js'
// import 'gun/lib/rindexed.js'
// import 'gun/lib/webrtc.js'
// import 'gun/lib/yson.js'
// import 'gun/lib/open.js'

class Controller {
    constructor() {
        this.gun = Gun({
            peers: ['wss://59.src.eco/gun', 'wss://95.src.eco/gun'],
            file: 'gun',
            localStorage: false,
            radisk: false,
            axe: false
        })
    }

    subscribe(focus) {
        return this.gun.get('src').get('bullets').get(focus)
    }
}

export default Controller
