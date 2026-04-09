import { expect } from "@samual/assert"
import type { LaxPartial } from "@samual/types"

const { floor, ceil } = Math
const { isInteger } = Number

const mask = (bitLength: number): number => (1 << bitLength) - 1

const bitsFromRight = (
	/** Number to read bits from */ input: number,
	/** Offset from the right of where to start reading from */ offset: number,
	/** Number of bits to read */ bitsToRead: number
): number => (input >> offset) & mask(bitsToRead)

const bitsFromLeft = (
	/** Number to read bits from */ input: number,
	/** Length of input in bits */ inputBitLength: number,
	/** Offset from the left of where to start reading from */ offset: number,
	/** Number of bits to read */ bitsToRead: number,
	{ sloppy = false }: LaxPartial<{ sloppy: boolean }> = {}
): number => {
	if (!(inputBitLength > 1))
		throw RangeError(`inputBitLength must be > 1`, { cause: { inputBitLength } })

	if (!isInteger(inputBitLength))
		throw RangeError(`inputBitLength must be an integer`, { cause: { inputBitLength } })

	if (!sloppy && offset < 0)
		throw RangeError(`offset must be >= 0`, { cause: { offset } })

	if (!isInteger(offset))
		throw RangeError(`offset must be an integer`, { cause: { offset } })

	if (offset + bitsToRead > inputBitLength)
		throw RangeError(`Tried to read outside input`, { cause: { offset, bitsToRead, inputBitLength } })

	return bitsFromRight(input, inputBitLength - offset - bitsToRead, bitsToRead)
}

const arrayBits = (
	/** Array of numbers to read from */ data: ArrayLike<number>,
	/** Number of bits per element */ bitsPerElement: number,
	/** Offset in bits into `data` */ bitOffset: number,
	/** Number of bits to read */ bitsToRead: number,
	{ sloppy = false }: LaxPartial<{ sloppy: boolean }> = {}
): number => {
	const at: (index: number) => number = sloppy ? index => data[index] || 0 : index => expect(data[index], HERE)
	let index = floor(bitOffset / bitsPerElement)

	if ((bitOffset %= bitsPerElement) + bitsToRead < bitsPerElement)
		return bitsFromLeft(at(index), bitsPerElement, bitOffset, bitsToRead, { sloppy: true })

	const firstBitsToRead = bitsPerElement - bitOffset
	let result = (at(index++) & mask(firstBitsToRead)) << (bitsToRead -= firstBitsToRead)

	while (bitsToRead > bitsPerElement)
		result += at(index++) << (bitsToRead -= bitsPerElement)

	if (bitsToRead)
		return result | bitsFromLeft(at(index), bitsPerElement, 0, bitsToRead)

	return result
}

type MutableArrayLike<T> = { readonly length: number, [n: number]: T }

export const repack: {
	<T extends MutableArrayLike<number>>(
		input: ArrayLike<number>,
		bitsPerElement: number,
		toBitsPerElement: number,
		options: { bitOffset?: number | undefined, Array: { new(arrayLength: number): T } }
	): T
	(
		input: ArrayLike<number>,
		bitsPerElement: number,
		toBitsPerElement: number,
		options?: { bitOffset?: number | undefined, Array?: undefined }
	): number[]
} = (
	input: ArrayLike<number>,
	bitsPerElement: number,
	toBitsPerElement: number,
	options?: LaxPartial<{ bitOffset: number, Array: { new(arrayLength: number): MutableArrayLike<number> } }>
) => {
	const result = new (options?.Array || Array<number>)(ceil(((input.length * bitsPerElement) - (options?.bitOffset || 0)) / toBitsPerElement))

	repackInto(input, result, bitsPerElement, toBitsPerElement, options)

	return result as any
}

export const repackInto = (
	input: ArrayLike<number>,
	into: MutableArrayLike<number>,
	bitsPerElement: number,
	toBitsPerElement: number,
	{ bitOffset = 0 }: LaxPartial<{ bitOffset: number }> = {}
): void => {
	for (let index = 0; index < into.length; index++, bitOffset += toBitsPerElement)
		into[index] = arrayBits(input, bitsPerElement, bitOffset, toBitsPerElement, { sloppy: true })
}

if (import.meta.vitest) {
	const { test, expect } = import.meta.vitest

	test(`bitsFromLeft()`, () => {
		expect(bitsFromLeft(0b1110_0000, 8, 0, 3)).toBe(0b111)
		expect(bitsFromLeft(0b0011_1100, 8, 2, 4)).toBe(0b1111)
		expect(bitsFromLeft(0b0001_1111, 8, 3, 5)).toBe(0b1_1111)

		expect(() => bitsFromLeft(0, 8, -1, 1)).toThrow(RangeError)
		expect(() => bitsFromLeft(0, 8, 8, 1)).toThrow(RangeError)
		expect(() => bitsFromLeft(0, 8, 4, 5)).toThrow(RangeError)
	})

	test(`arrayBits()`, () => {
		expect(arrayBits([ 0, 0b000101000 ], 9, 9 + 3, 3)).toBe(0b101)
		expect(arrayBits([ 0, 0b0101 ], 4, 4 + 1, 3)).toBe(0b101)
		expect(arrayBits([ 0, 0b0000_1010, 0b1010_0000 ], 8, 8 + 4, 7)).toBe(0b101_0101)
		expect(arrayBits([ 0b1010_0000 ], 8, 0, 3)).toBe(0b101)
		expect(arrayBits([ 0b0101_0000 ], 8, 1, 3)).toBe(0b101)
		expect(arrayBits([ 0b0010_1000 ], 8, 2, 3)).toBe(0b101)
		expect(arrayBits([ 0b0001_0100 ], 8, 3, 3)).toBe(0b101)
		expect(arrayBits([ 0b0000_1010 ], 8, 4, 3)).toBe(0b101)
		expect(arrayBits([ 0b0000_0101 ], 8, 5, 3)).toBe(0b101)

		expect(arrayBits([ 0b1000_0010 ], 8, 0, 7)).toBe(0b100_0001)
		expect(arrayBits([ 0b0100_0001 ], 8, 1, 7)).toBe(0b100_0001)

		expect(arrayBits([ 0, 0b0100_0001 ], 8, 9, 7)).toBe(0b100_0001)

		expect(arrayBits([ 0b0000_1000, 0b0001_0000 ], 8, 4, 8)).toBe(0b1000_0001)

		expect(arrayBits([ 0b0000_0010, 0b0101_0101, 0b1100_0000 ], 8, 6, 12)).toBe(0b1001_0101_0111)
	})

	test(`repack()`, () => {
		expect(repack([ 0b1000001_1 ], 8, 7)).toStrictEqual([ 0b1000001, 0b1_000000 ])
		expect(repack([ 0b100001_11 ], 8, 6)).toStrictEqual([ 0b100001, 0b11_0000 ])
		expect(repack([ 0b10001_101 ], 8, 5)).toStrictEqual([ 0b10001, 0b101_00 ])
		expect(repack([ 0b1001_1001 ], 8, 4)).toStrictEqual([ 0b1001, 0b1001 ])
		expect(repack([ 0b101_101_11 ], 8, 3)).toStrictEqual([ 0b101, 0b101, 0b11_0 ])
		expect(repack([ 0b11_11_11_11 ], 8, 2)).toStrictEqual([ 0b11, 0b11, 0b11, 0b11 ])
		expect(repack([ 0b10110110 ], 8, 1)).toStrictEqual([ 1, 0, 1, 1, 0, 1, 1, 0 ])

		expect(repack([ 0b10001_100, 0b01_10001_1 ], 8, 5)).toStrictEqual([ 0b10001, 0b10001, 0b10001, 0b1_0000 ])
		expect(repack([ 0b10001_100, 0b01_10001_1, 0b0001_1001 ], 8, 5)).toStrictEqual([ 0b10001, 0b10001, 0b10001, 0b10001, 0b1001_0 ])
		expect(repack([ 0b000_10001, 0b10001_100, 0b01_10001_0 ], 8, 5, { bitOffset: 3 })).toStrictEqual([ 0b10001, 0b10001, 0b10001, 0b10001, 0 ])

		expect(repack([ 0xFF, 0xFF ], 8, 5, { bitOffset: 8 })).toStrictEqual([ 0b11111, 0b11100 ])
		expect(repack([ 0xFF ], 8, 5, { bitOffset: -5 })).toStrictEqual([ 0, 0b11111, 0b11100 ])
	})
}
