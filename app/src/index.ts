type AvailableFormats = 'buffer' | 'hex' | 'number' | 'bigint';

const getBitCount = (n: number) => n.toString(2).length;
const bufferToBigInt = (buffer: Buffer, isUnsigned: boolean) => {
    let value = BigInt(isUnsigned ? buffer.readUintLE(buffer.length - 1, 1) : buffer.readIntLE(buffer.length - 1, 1));

    for (let i = buffer.length - 2; i >= 0; i--) {
        value = value << 8n;
        value |= BigInt(buffer[ i ]);
    }

    return value;
};

export default class WBuffer extends Buffer {
    /* @depracted Use `WBuffer.from(string[, encoding])` instead.*/
    constructor(arg1: string, arg2?: BufferEncoding) {
        super(arg1, arg2);
        throw new Error('use WBuffer.create(buffer)');
    }

    static create(buffer: Buffer) {
        if (buffer instanceof WBuffer) {
            return buffer;
        }
        Object.setPrototypeOf(buffer, WBuffer.prototype);
        return (buffer as unknown as WBuffer).seek(0);
    }

    protected $cursor = 0;
    public get cursor() {
        return this.$cursor;
    }
    public set cursor(value: number) {
        if (value < 0) {
            this.$cursor = 0;
        } else if (value >= this.length) {
            this.$cursor = this.length - 1;
        } else {
            this.$cursor = value;
        }
    }

    public seek(value: number) {
        this.cursor = value;
        return this;
    }

    readLeb128(format: 'buffer'): WBuffer;
    readLeb128(format: 'hex'): string;
    readLeb128(format: 'number'): number;
    readLeb128(format: 'bigint'): bigint;
    readLeb128(): number;
	readLeb128(format: AvailableFormats = 'number') {
        return this.$readLebUleb128(true, format);
    }

    readUleb128(format: 'buffer'): WBuffer;
    readUleb128(format: 'hex'): string;
    readUleb128(format: 'number'): number;
    readUleb128(format: 'bigint'): bigint;
    readUleb128(): number;
    readUleb128(format: AvailableFormats = 'number') {
        return this.$readLebUleb128(false, format);
    }
    $readLebUleb128(isLeb128: boolean, format: AvailableFormats = 'number') {
        let countOfInputBytes = 0;
        let countOfBits = 0;
        let isNegative = 0;

        while (this[this.cursor + countOfInputBytes] & 0x80) {
            countOfInputBytes++;
            countOfBits+= 7;
        }
        
        countOfInputBytes = Math.min(countOfInputBytes, this.length - this.cursor - 1);

        const lastByte = this[this.cursor + countOfInputBytes];

        countOfBits+= getBitCount(lastByte);
        countOfInputBytes++;

        if (isLeb128) {
            isNegative = lastByte & 0x40;
        }
        
        const result = Buffer.alloc(Math.ceil((countOfBits + 1) / 8), 0);

        for (
            let i = 0, ii = 0, j = this.cursor;
            ii < countOfInputBytes;
            i++, ii++, j++
        ) {
            switch (ii % 8) {
                case 0:
                    result[i] = 0x7f & this[j];
                    break;
                case 1:
                    result[i - 1] |= (0x01 & this[j]) << 7;
                    result[i] = (0x7f & this[j]) >> 1;
                    break;
                case 2:
                    result[i - 1] |= (0x03 & this[j]) << 6;
                    result[i] = (0x7f & this[j]) >> 2;
                    break;
                case 3:
                    result[i - 1] |= (0x07 & this[j]) << 5;
                    result[i] = (0x7f & this[j]) >> 3;
                    break;
                case 4:
                    result[i - 1] |= (0x0f & this[j]) << 4;
                    result[i] = (0x7f & this[j]) >> 4;
                    break;
                case 5:
                    result[i - 1] |= (0x1f & this[j]) << 3;
                    result[i] = (0x7f & this[j]) >> 5;
                    break;
                case 6:
                    result[i - 1] |= (0x3f & this[j]) << 2;
                    result[i] = (0x7f & this[j]) >> 6;
                    break;
                case 7:
                    result[i - 1] |= (0x7f & this[j]) << 1;
                    i--;
                    break;
            }
        }

        this.cursor += countOfInputBytes;

        if (isNegative) {
            result[ result.length - 1 ] |= 0xff << (7 - (result.length % 8));
        }

        switch (format) {
            case 'hex': return result.toString('hex');
            case 'number': {
                if (isNegative) {
                    return result.readIntLE(0, result.length);
                }

                return result.readUIntLE(0, result.length);
            }
            case 'bigint': return bufferToBigInt(result, !isLeb128);
            case 'buffer': return WBuffer.from(result);
        }
    }

    read(length: number) {
        const result = this.slice(
            this.cursor,
            this.cursor + length
        );

        this.cursor += length;

        return result;
    }

    readArrayOfUleb128() {
        const arrayLength = this.readUleb128();
        const result = new Array(arrayLength) as WBuffer[];

        for (let i = 0; i < arrayLength; i++) {
            result[i] = this.read(this.readUleb128());
        }

        return result;
    }

    static arrayUleb128ToBuffer(list: Buffer[]) {
        return WBuffer.create(Buffer.concat([
            WBuffer.numberToUleb128Buffer(list.length),
            ...list.map((item) => Buffer.concat([
                WBuffer.numberToUleb128Buffer(item.length),
                item
            ]))
        ]));
    }

    static numberToLeb128Buffer(value: number | bigint) {
        const result = [] as number[];

        if (typeof value === 'bigint') {
            while (true) {
                const byte = Number(value & 0x7fn);

                value = value >> 7n;

                if ((value == 0n && (byte & 0x40) == 0) || (value == -1n && (byte & 0x40) != 0)) {
                    result.push(byte);

                    return WBuffer.from(result);
                }

                result.push(0x80 | byte)
            }
        } else {
            while (true) {
                const byte = value & 0x7f;

                value = value >> 7;

                if ((value == 0 && (byte & 0x40) == 0) || (value == -1 && (byte & 0x40) != 0)) {
                    result.push(byte);

                    return WBuffer.from(result);
                }

                result.push(0x80 | byte)
            }
        }
    }

    static numberToUleb128Buffer(value: number | bigint) {
        if (value < 0) {
            throw new Error('The value must be unsigned');
        }

        const result = [] as number[];
        let currentIndex = 0;

        if (value) {
            if (typeof value === 'bigint') {
                let currentValue = value;

                while (currentValue !== 0n) {
                    result[currentIndex] = Number(currentValue & 0x7fn);
    
                    currentValue = currentValue >> 7n;
    
                    if (currentValue) {
                        result[currentIndex] |= 0x80;
                    }
    
                    currentIndex++;
                }
            } else {
                let currentValue = value;

                while (currentValue) {
                    result[currentIndex] = currentValue & 0x7f;
    
                    currentValue = currentValue >>> 7;
    
                    if (currentValue) {
                        result[currentIndex] |= 0x80;
                    }
    
                    currentIndex++;
                }
            }
        } else {
            result.push(0);
        }

        return WBuffer.from(result);
    }

    /***************************/

    static concat(...args: Parameters<typeof Buffer.concat>) {
        return WBuffer.create(
            super.concat(...args)
        );
    }

    static from(arrayBuffer: ArrayBuffer | SharedArrayBuffer, byteOffset?: number, length?: number): WBuffer;
    static from(data: number[]): WBuffer;
    static from(data: Uint8Array): WBuffer;
    static from(obj: { valueOf(): string | object } | { [Symbol.toPrimitive](hint: 'string'): string }, byteOffset?: number, length?: number): WBuffer;
    static from(str: string, encoding?: BufferEncoding): WBuffer;
    static from(...args: any[]) {
        return WBuffer.create(
            //@ts-ignore
            super.from(...args)
        );
    }

    static alloc(...args: Parameters<typeof Buffer.alloc>) {
        return WBuffer.create(
            //@ts-ignore
            super.alloc(...args)
        );
    }

    public _isBuffer = true;
    static compare(a: WBuffer, b: WBuffer) {
        return super.compare(a, b);
    }

    //@ts-ignore rewrite
    public slice(start?: number, end?: number): WBuffer {
        return WBuffer.create(
            Uint8Array.prototype.slice.call(this, start, end)
        );
    }

    //@ts-ignore rewrite
    public toJSON() {
        return `Buff[${this.toString('hex')}]`;
    }
}
