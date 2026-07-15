import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface ScreenshotStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export interface StoredScreenshot {
  key: string;
  contentType: "image/jpeg";
  size: number;
}

export function buildScreenshotKey(userId: string, executionId: string): string {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(userId) || !uuidPattern.test(executionId)) {
    throw new Error("Screenshot keys require UUID identifiers");
  }
  return `users/${userId}/executions/${executionId}/page.jpg`;
}

export class ScreenshotStore {
  readonly #client: S3Client;
  readonly #bucket: string;

  constructor(config: ScreenshotStorageConfig) {
    this.#bucket = config.bucket;
    this.#client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async assertReady(): Promise<void> {
    await this.#client.send(new HeadBucketCommand({ Bucket: this.#bucket }));
  }

  async put(userId: string, executionId: string, body: Uint8Array): Promise<StoredScreenshot> {
    const key = buildScreenshotKey(userId, executionId);
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: key,
        Body: body,
        ContentType: "image/jpeg",
        CacheControl: "private, max-age=900",
        ServerSideEncryption: "AES256",
        Metadata: {
          execution: executionId,
        },
      }),
    );
    return { key, contentType: "image/jpeg", size: body.byteLength };
  }

  async get(key: string): Promise<{ body: Uint8Array; contentType: string; etag?: string }> {
    const response = await this.#client.send(new GetObjectCommand({ Bucket: this.#bucket, Key: key }));
    if (!response.Body) throw new Error("Screenshot object has no body");
    return {
      body: await response.Body.transformToByteArray(),
      contentType: response.ContentType ?? "application/octet-stream",
      ...(response.ETag ? { etag: response.ETag } : {}),
    };
  }

  async delete(key: string): Promise<void> {
    await this.#client.send(new DeleteObjectCommand({ Bucket: this.#bucket, Key: key }));
  }

  destroy(): void {
    this.#client.destroy();
  }
}
