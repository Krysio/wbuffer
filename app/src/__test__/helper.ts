export function randomBuffer(
    length: number
) {
    let hex = '';
    for (let i = 0; i < length; i++) {
        hex+= ("f" + Math.random().toString(16).replace(".", "")).substr(-2, 2);
    }
    return Buffer.from(hex, 'hex');
}

export function randomKey() {
    return randomBuffer(32);
}

export function randomData() {
    return randomBuffer(256 + Math.floor(Math.random() * 1024));
}
