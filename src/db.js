class DatabaseHandler {
    constructor() {
        this.eventTarget = new EventTarget()
    }

    on(eventName, listener) {
        this.eventTarget.addEventListener(eventName, listener)
    }

    off(eventName, listener) {
        this.eventTarget.removeEventListener(eventName, listener)
    }

    emit(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data })
        this.eventTarget.dispatchEvent(event)
    }
}

export default new DatabaseHandler()
