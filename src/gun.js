import Gun from 'gun'

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
        this.focus = this.gun.get('src').get('bullets').get(focus)
        return this.focus
    }

    send(message) {
        this.focus.put(
            JSON.stringify({
                identifier: 'GhostIsCuteVoidGirl',
                message,
                pubKey: null
            })
        )
    }
}

export default Controller
