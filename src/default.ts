import type { Brand } from "@samual/types"
import { decodeBase64Url, encodeBase64Url } from "@std/encoding"
import { repack, repackInto } from "./internal.ts"

export type NanulidBase64 = Brand<string, { readonly NanulidBase64: unique symbol }[`NanulidBase64`]>
export type NanulidCrockford = Brand<string, { readonly NanulidCrockford: unique symbol }[`NanulidCrockford`]>

/** 21 byte `ArrayBuffer` */
export type NanulidBuffer = Brand<ArrayBuffer, { readonly NanulidBuffer: unique symbol }[`NanulidBuffer`]>

/** 21 byte `Uint8Array` */
export type NanulidBytes = Brand<Uint8Array<NanulidBuffer>, { readonly NanulidBytes: unique symbol }[`NanulidBytes`]>

const NanulidBytesSize = 21
const NanulidBytesTimeSectionSize = 6
const NanulidBytesRandomSectionSize = NanulidBytesSize - NanulidBytesTimeSectionSize

export const NanulidBase64Regex = /^[\w-]{28}$/
export const isNanulidBase64 = (input: string): input is NanulidBase64 => NanulidBase64Regex.test(input)

export const toNanulidBase64 = (input: string): NanulidBase64 => {
	if (isNanulidBase64(input))
		return input

	throw TypeError(`Invalid Nanulid Base64 string`)
}

export const NanulidCrockfordRegex = /^[\dA-HJKMNP-TV-Z]{34}$/
export const isNanulidCrockford = (input: string): input is NanulidCrockford => NanulidCrockfordRegex.test(input)

export const toNanulidCrockford = (input: string): NanulidCrockford => {
	if (isNanulidCrockford(input))
		return input

	throw TypeError(`Invalid Nanulid Crockford string`)
}

export const isNanulidBuffer = (input: ArrayBuffer): input is NanulidBuffer => input.byteLength == NanulidBytesSize

export const toNanulidBuffer = (input: ArrayBuffer): NanulidBuffer => {
	if (isNanulidBuffer(input))
		return input

	throw TypeError(`Invalid Nanulid ArrayBuffer`)
}

export const isNanulidBytes = (input: Uint8Array): input is NanulidBytes => input.byteLength == NanulidBytesSize

export const toNanulidBytes = (input: Uint8Array): NanulidBytes => {
	if (isNanulidBytes(input))
		return input

	throw TypeError(`Invalid Nanulid Uint8Array`)
}

export const makeEmptyNanulidBuffer = (): NanulidBuffer => new ArrayBuffer(NanulidBytesSize) as NanulidBuffer
export const makeEmptyNanulidBytes = (): NanulidBytes => new Uint8Array(NanulidBytesSize) as NanulidBytes

export const setNanulidBytesTime = (nanulidBytes: NanulidBytes, time = Date.now()): void => {
	nanulidBytes[0] = time / (2 ** 40)
	nanulidBytes[1] = time / (2 ** 32)
	nanulidBytes[2] = time >> 24
	nanulidBytes[3] = time >> 16
	nanulidBytes[4] = time >> 8
	nanulidBytes[5] = time
}

export const getNanulidBytesTime = (nanulidBytes: NanulidBytes): number =>
	(nanulidBytes[0]! * (2 ** 40)) + (nanulidBytes[1]! * (2 ** 32)) + (nanulidBytes[2]! * (2 ** 24)) +
		(nanulidBytes[3]! << 16) + (nanulidBytes[4]! << 8) + (nanulidBytes[5]!)

const RANDOM_BYTES_SIZE = NanulidBytesRandomSectionSize * 256
const randomBytes = new Uint8Array(RANDOM_BYTES_SIZE)
let randomBytesOffset = 0

export const setNanulidBytesRandom = (nanulidBytes: NanulidBytes): void => {
	if (!(randomBytesOffset %= RANDOM_BYTES_SIZE))
		crypto.getRandomValues(randomBytes)

	nanulidBytes.set(
		randomBytes.subarray(randomBytesOffset, randomBytesOffset += NanulidBytesRandomSectionSize),
		NanulidBytesTimeSectionSize
	)
}

export const makeNanulidBytes = (): NanulidBytes => {
	const nanulidBytes = makeEmptyNanulidBytes()
	
	setNanulidBytesTime(nanulidBytes)
	setNanulidBytesRandom(nanulidBytes)

	return nanulidBytes
}

export const makeNanulidBuffer = (): NanulidBuffer => makeNanulidBytes().buffer

export const nanulidBytesToBase64 = (nanulidBytes: NanulidBytes): NanulidBase64 => toNanulidBase64(encodeBase64Url(nanulidBytes))

export const nanulidBufferToBase64 = (nanulidBuffer: NanulidBuffer): NanulidBase64 => toNanulidBase64(encodeBase64Url(nanulidBuffer))

export const makeNanulidBase64 = (): NanulidBase64 => toNanulidBase64(encodeBase64Url(makeNanulidBytes()))

const Crockford = `0123456789ABCDEFGHJKMNPQRSTVWXYZ`
const CrockfordCharCodes = new Uint8Array(Crockford.split(``).map(char => char.charCodeAt(0)))
const textDecoder = new TextDecoder

export const nanulidBytesToCrockford = (nanulidBytes: NanulidBytes): NanulidCrockford => {
	const result = repack(nanulidBytes, 8, 5, { bitOffset: -2, Array: Uint8Array })

	for (let index = result.length; index--;)
		result[index] = CrockfordCharCodes[result[index]!]!

	return toNanulidCrockford(textDecoder.decode(result))
}

export const nanulidBase64ToBytes = (nanulidBase64: NanulidBase64): NanulidBytes => toNanulidBytes(decodeBase64Url(nanulidBase64))

const textEncoder = new TextEncoder

const decodeCrockfordCharCode = (charCode: number): number => {
	if (charCode > 85)
		return charCode - 59

	if (charCode > 79)
		return charCode - 58

	if (charCode > 76)
		return charCode - 57

	if (charCode > 73)
		return charCode - 56

	if (charCode > 64)
		return charCode - 55

	return charCode - 48
}

export const nanulidCrockfordToBytes = (nanulidCrockford: NanulidCrockford): NanulidBytes => {
	const decoded = textEncoder.encode(nanulidCrockford)

	for (let index = decoded.length; index--;)
		decoded[index] = decodeCrockfordCharCode(decoded[index]!)

	const result = toNanulidBytes(decoded.subarray(0, NanulidBytesSize))

	repackInto(decoded, result, 5, 8, { bitOffset: 2 })

	return result
}

export const makeNanulidCrockford = (): NanulidCrockford => nanulidBytesToCrockford(makeNanulidBytes())

if (import.meta.vitest) {
	const { test, expect } = import.meta.vitest

	test(`getting time`, () => {
		expect(getNanulidBytesTime(nanulidBase64ToBytes(toNanulidBase64(`AZp868zqDHzM_4-vaqhobaPvDRUh`))))
			.toBe(1763032419562)
	})

	test(`decode crockford char codes`, () => {
		for (const charCode of CrockfordCharCodes)
			expect(decodeCrockfordCharCode(charCode)).toBe(CrockfordCharCodes.indexOf(charCode))
	})

	test(`nanulid crockford to bytes`, () => {
		const nanulidBytes = makeNanulidBytes()
		const nanulidCrockford = nanulidBytesToCrockford(nanulidBytes)

		expect(nanulidCrockfordToBytes(nanulidCrockford)).toMatchObject(nanulidBytes)
	})
}
