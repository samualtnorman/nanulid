import type { Brand } from "@samual/types"
import { decodeBase64Url, encodeBase64Url } from "@std/encoding"
import { unpackBits } from "./internal.ts"

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
	(nanulidBytes[0]! * (2 ** 40)) + (nanulidBytes[1]! * (2 ** 32)) + (nanulidBytes[2]! << 24) +
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

export const nanulidBytesToBase64 = (nanulidBytes: NanulidBytes): NanulidBase64 => encodeBase64Url(nanulidBytes) as any

export const nanulidBufferToBase64 = (nanulidBuffer: NanulidBuffer): NanulidBase64 => encodeBase64Url(nanulidBuffer) as any

export const makeNanulidBase64 = (): NanulidBase64 => encodeBase64Url(makeNanulidBytes()) as any

const Crockford = `0123456789ABCDEFGHJKMNPQRSTVWXYZ`
const CrockfordCharCodes = new Uint8Array(Crockford.split(``).map(char => char.charCodeAt(0)))
const textDecoder = new TextDecoder

export const nanulidBytesToCrockford = (nanulidBytes: NanulidBytes): NanulidCrockford => {
	const result = unpackBits(nanulidBytes, 5, { bitOffset: -2 })

	for (let index = result.length; index--;)
		result[index] = CrockfordCharCodes[result[index]!]!

	return textDecoder.decode(result) as any
}

export const nanulidBase64ToBytes = (nanulidBase64: NanulidBase64): NanulidBytes => decodeBase64Url(nanulidBase64) as NanulidBytes

export const makeNanulidCrockford = (): NanulidCrockford => nanulidBytesToCrockford(makeNanulidBytes())

if (import.meta.vitest) {
	const { test, expect } = import.meta.vitest

	test(`getting time`, () => {
		expect(getNanulidBytesTime(nanulidBase64ToBytes(`AZp868zqDHzM_4-vaqhobaPvDRUh` as NanulidBase64)))
			.toBe(1763032419562)
	})
}
