export class EventBus {
  #listeners = new Map();

  on(eventName, listener) {
    if (!this.#listeners.has(eventName)) this.#listeners.set(eventName, new Set());
    this.#listeners.get(eventName).add(listener);
    return () => this.off(eventName, listener);
  }

  off(eventName, listener) {
    this.#listeners.get(eventName)?.delete(listener);
  }

  emit(eventName, detail = {}) {
    const event = Object.freeze({ type: eventName, detail });
    for (const listener of this.#listeners.get(eventName) ?? []) {
      try {
        listener(event);
      } catch (error) {
        queueMicrotask(() => { throw error; });
      }
    }
    for (const listener of this.#listeners.get("*") ?? []) {
      try {
        listener(event);
      } catch (error) {
        queueMicrotask(() => { throw error; });
      }
    }
    return event;
  }

  clear() {
    this.#listeners.clear();
  }
}
