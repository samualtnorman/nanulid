import type { LaxPartial } from "@samual/types"

export const bitsInByte = (
	byte: number,
	offset: number,
	length?: number,
	{ loose = false }: LaxPartial<{ loose: boolean }> = {}
): number => {
	if (!loose && offset < 0 || offset > 7)
		throw RangeError(`offset must be between and including 0 and 7`)

	if (length == undefined)
		return byte & ((1 << (8 - offset)) - 1)

	if (length < 0)
		throw RangeError(`length must be at least 0`)

	if (offset + length > 8)
		throw RangeError(`Tried to read bits outside of byte`)

    return (byte >> (8 - (offset + length))) & ((1 << length) - 1)
}

function readAtBitOffset(
	/** Byte array to read. */ bytes: ArrayLike<number>,
	/** Offset in bits */ bitOffset: number,
	/** Number of bits to read */ bitLength: number,
	{ loose = false }: LaxPartial<{ loose: boolean }> = {}
) {
	if (bitLength < 0 || bitLength > 53)
		throw RangeError(`bitLength must be between and including 0 and 53`)
	
	if (!loose && bitOffset + bitLength > bytes.length * 8)
		throw RangeError(`Tried to read out of bounds (bytes.length: ${bytes.length}, bitOffset: ${bitOffset}, bitLength: ${bitLength})`)

	let index = Math.floor(bitOffset / 8)

	let result = bitsInByte(
		bytes[index++] || 0,
		bitOffset % 8,
		(bitOffset % 8) + bitLength > 7 ? undefined : bitLength,
		{ loose: true }
	)

	bitLength -= 8 - (bitOffset % 8)

	for (; bitLength > 8; bitLength -= 8)
		result = (result * (2 ** 8)) + (bytes[index++] || 0)

	if (bitLength > 0)
		result = (result * (2 ** bitLength)) + ((bytes[index] || 0) >> (8 - bitLength))

	return result
}

export function unpackBits(
	bytes: ArrayLike<number>,
	bits: number,
	{ bitOffset = 0 }: LaxPartial<{ bitOffset: number }> = {}
): Uint8Array {
	const result = new Uint8Array(Math.ceil(((bytes.length * 8) - bitOffset) / bits))

	for (let index = 0; bitOffset < bytes.length * 8; bitOffset += bits, index++)
		result[index] = readAtBitOffset(bytes, bitOffset, bits, { loose: true })
	
	return result
}

if (import.meta.vitest) {
	const { test, expect } = import.meta.vitest

	test(`bitsInByte()`, () => {
		expect(bitsInByte(0b1110_0000, 0, 3)).toBe(0b111)
		expect(bitsInByte(0b0011_1100, 2, 4)).toBe(0b1111)
		expect(bitsInByte(0b0001_1111, 3, 5)).toBe(0b1_1111)
		expect(bitsInByte(0b0001_1111, 3)).toBe(0b1_1111)

		expect(() => bitsInByte(0, -1)).toThrow(RangeError)
		expect(() => bitsInByte(0, 8)).toThrow(RangeError)
		expect(() => bitsInByte(0, 4, 5)).toThrow(RangeError)
	})

	test(`readAtBitOffset()`, () => {
		expect(readAtBitOffset([ 0b1010_0000 ], 0, 3)).toBe(0b101)
		expect(readAtBitOffset([ 0b0101_0000 ], 1, 3)).toBe(0b101)
		expect(readAtBitOffset([ 0b0010_1000 ], 2, 3)).toBe(0b101)
		expect(readAtBitOffset([ 0b0001_0100 ], 3, 3)).toBe(0b101)
		expect(readAtBitOffset([ 0b0000_1010 ], 4, 3)).toBe(0b101)
		expect(readAtBitOffset([ 0b0000_0101 ], 5, 3)).toBe(0b101)

		expect(readAtBitOffset([ 0b1000_0010 ], 0, 7)).toBe(0b100_0001)
		expect(readAtBitOffset([ 0b0100_0001 ], 1, 7)).toBe(0b100_0001)

		expect(readAtBitOffset([ 0, 0b0100_0001 ], 9, 7)).toBe(0b100_0001)

		expect(readAtBitOffset([ 0b0000_1000, 0b0001_0000 ], 4, 8)).toBe(0b1000_0001)

		expect(readAtBitOffset([ 0b0000_0010, 0b0101_0101, 0b1100_0000 ], 6, 12)).toBe(0b1001_0101_0111)
	})

	test(`unpackBits()`, () => {
		expect(unpackBits([ 0b1000001_1 ], 7)).toStrictEqual(new Uint8Array([ 0b1000001, 0b1_000000 ]))
		expect(unpackBits([ 0b100001_11 ], 6)).toStrictEqual(new Uint8Array([ 0b100001, 0b11_0000 ]))
		expect(unpackBits([ 0b10001_101 ], 5)).toStrictEqual(new Uint8Array([ 0b10001, 0b101_00 ]))
		expect(unpackBits([ 0b1001_1001 ], 4)).toStrictEqual(new Uint8Array([ 0b1001, 0b1001 ]))
		expect(unpackBits([ 0b101_101_11 ], 3)).toStrictEqual(new Uint8Array([ 0b101, 0b101, 0b11_0 ]))
		expect(unpackBits([ 0b11_11_11_11 ], 2)).toStrictEqual(new Uint8Array([ 0b11, 0b11, 0b11, 0b11 ]))
		expect(unpackBits([ 0b10110110 ], 1)).toStrictEqual(new Uint8Array([ 1, 0, 1, 1, 0, 1, 1, 0 ]))

		expect(unpackBits([ 0b10001_100, 0b01_10001_1 ], 5)).toStrictEqual(new Uint8Array([ 0b10001, 0b10001, 0b10001, 0b1_0000 ]))
		expect(unpackBits([ 0b10001_100, 0b01_10001_1, 0b0001_1001 ], 5)).toStrictEqual(new Uint8Array([ 0b10001, 0b10001, 0b10001, 0b10001, 0b1001_0 ]))
		expect(unpackBits([ 0b000_10001, 0b10001_100, 0b01_10001_0 ], 5, { bitOffset: 3 })).toStrictEqual(new Uint8Array([ 0b10001, 0b10001, 0b10001, 0b10001, 0 ]))

		expect(unpackBits([ 0xFF, 0xFF ], 5, { bitOffset: 8 })).toStrictEqual(new Uint8Array([ 0b11111, 0b11100 ]))
		expect(unpackBits([ 0xFF ], 5, { bitOffset: -5 })).toStrictEqual(new Uint8Array([ 0, 0b11111, 0b11100 ]))
	})
}
