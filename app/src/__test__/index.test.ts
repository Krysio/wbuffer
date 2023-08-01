import WBuffer from "../index";
import { randomData } from "./helper";

let a = Buffer.alloc(8);
a.writeIntLE(255, 0, 4);
a.writeIntLE(-256, 4, 4);
console.log(a);

it('leb128', () => {
    for (let [expected, bufferValue] of [[0, [0x80]]] as [number, number[]][]) {
        const buffer = WBuffer.from(bufferValue);
        const result = buffer.seek(0).readLeb128();

        expect(result).toBe(expected);
        expect(buffer.cursor).toBeLessThanOrEqual(buffer.length);
    }

    for (let value of [1, 2, 0, 128, 9999999, -10, -101, -9999999, 0xffffffn, -0xffffffn, -9999999999999n, 0xffffffffffffffn, -0xffffffffffffffn]) {
        const buffer = WBuffer.numberToLeb128Buffer(value);
        const result = buffer.seek(0).readLeb128(typeof value as any);

        expect(result).toBe(value);
    }

    for (let i = 0; i < 1000; i++) {
        const value = parseInt((Math.random() * 100000000 * i % 2 ? 1 : -1).toString());
        const buffer = WBuffer.numberToLeb128Buffer(value);
        const result = buffer.seek(0).readLeb128();

        expect(result).toBe(value);
    }
});

it('uleb128', () => {
    for (let [expected, bufferValue] of [[0, [0x80]]] as [number, number[]][]) {
        const buffer = WBuffer.from(bufferValue);
        const result = buffer.seek(0).readLeb128();

        expect(result).toBe(expected);
        expect(buffer.cursor).toBeLessThanOrEqual(buffer.length);
    }

    for (let value of [128, 607, 101, 9999999, 0xffffffffffffn, 0xffffffffffffffn]) {
        const buffer = WBuffer.numberToUleb128Buffer(value);
        const result = buffer.seek(0).readUleb128(typeof value as any);

        expect(result).toBe(value);
    }

    for (let i = 0; i < 1000; i++) {
        const value = parseInt((Math.random() * 100000000).toString());
        const buffer = WBuffer.numberToUleb128Buffer(value);
        const result = buffer.seek(0).readUleb128();

        expect(result).toBe(value);
    }
});

it('ulebSize, <ulebLength, buffer>[]', () => {
    for (let i = 0; i < 100; i++) {
        const value = [randomData(), randomData(), randomData()];
        const inputBuffer = WBuffer.arrayUleb128ToBuffer(value);
        const result = inputBuffer.readArrayOfUleb128();

        expect(Buffer.compare(result[0], value[0])).toBe(0);
        expect(Buffer.compare(result[1], value[1])).toBe(0);
        expect(Buffer.compare(result[2], value[2])).toBe(0);
    }
});
