class Cache {
  constructor(maxSize = 100, ttl = null) {
    this.maxSize = maxSize;
    this.ttl = ttl || 24 * 60 * 60 * 1000; // default 24 hours in milliseconds
    this.store = new Map();
    this.timestamps = new Map();
  }

  set(key, value, ttl = this.ttl) {
    // Remove oldest entry if cache is full
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey);
      this.timestamps.delete(firstKey);
    }

    this.store.set(key, value);
    this.timestamps.set(key, Date.now() + (ttl || 0));
  }

  get(key) {
    if (!this.store.has(key)) {
      return null;
    }

    // Check if entry has expired
    if (this.ttl || this.timestamps.get(key) > 0) {
      const expireTime = this.timestamps.get(key);
      if (expireTime > 0 && Date.now() > expireTime) {
        this.store.delete(key);
        this.timestamps.delete(key);
        return null;
      }
    }

    return this.store.get(key);
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.store.delete(key);
    this.timestamps.delete(key);
  }

  clear() {
    this.store.clear();
    this.timestamps.clear();
  }

  size() {
    return this.store.size;
  }

  keys() {
    return Array.from(this.store.keys());
  }
}

module.exports = cache = new Cache(500, 6 * 60 * 60 * 1000); // 500 items max, 6 hours TTL
