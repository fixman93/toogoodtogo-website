/**
 * Image storage on Cloudflare R2 (S3 API). Every upload is normalized first:
 * EXIF rotation applied, metadata (incl. GPS) stripped, resized and converted
 * to WebP — a 5 MB phone photo ends up around 100–200 KB.
 * All keys live under R2_PREFIX (e.g. "toogoodtogo/…") in the shared bucket.
 */
import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

export const IMAGE_KINDS = ['avatar', 'business-logo', 'business-cover', 'offer'] as const
export type ImageKind = (typeof IMAGE_KINDS)[number]

const configured = Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && env.R2_PUBLIC_URL)

const client = configured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
    })
  : null

export const storageEnabled = () => configured

const PRESETS: Record<ImageKind, { folder: string; width: number; height?: number; fit: 'cover' | 'inside' }> = {
  avatar: { folder: 'avatars', width: 400, height: 400, fit: 'cover' },
  'business-logo': { folder: 'businesses/logos', width: 400, height: 400, fit: 'cover' },
  'business-cover': { folder: 'businesses/covers', width: 1600, fit: 'inside' },
  offer: { folder: 'offers', width: 1600, fit: 'inside' },
}

const publicBase = () => `${env.R2_PUBLIC_URL!.replace(/\/$/, '')}/`

export async function putImage(file: Buffer, kind: ImageKind) {
  if (!client) throw new ApiError(503, 'STORAGE_DISABLED', 'Otpremanje slika trenutno nije podešeno.')
  const preset = PRESETS[kind]

  let image: Buffer
  try {
    image = await sharp(file, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: preset.width, height: preset.height, fit: preset.fit, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  } catch {
    throw ApiError.badRequest('Fajl nije ispravna slika (JPG, PNG, WebP ili HEIC).', 'INVALID_IMAGE')
  }

  const now = new Date()
  const key = `${env.R2_PREFIX}/${preset.folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.webp`
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: image,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
  return { url: publicBase() + key, key, bytes: image.length }
}

/** True for URLs of files this app uploaded (our bucket + our folder). */
export function isOwnedUrl(url?: string | null) {
  return Boolean(configured && url && url.startsWith(`${publicBase()}${env.R2_PREFIX}/`))
}

/** Remove a replaced image. Never touches files outside our folder. Never throws. */
export async function deleteIfOwned(url?: string | null) {
  if (!client || !url || !isOwnedUrl(url)) return
  try {
    await client.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: url.slice(publicBase().length) }))
  } catch (error) {
    console.error('R2 delete failed', error)
  }
}
