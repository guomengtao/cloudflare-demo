import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import env from '#start/env'

export class B2Service {
  private client: S3Client

  constructor() {
    this.client = new S3Client({
      endpoint: env.get('B2_ENDPOINT'), // 如: https://s3.us-west-004.backblazeb2.com
      region: env.get('B2_REGION'),
      credentials: {
        accessKeyId: env.get('B2_KEY_ID'),
        secretAccessKey: env.get('B2_APPLICATION_KEY'),
      },
    })
  }

  async upload(buffer: Buffer, fileName: string, contentType: string = 'image/webp') {
    const command = new PutObjectCommand({
      Bucket: env.get('B2_BUCKET'),
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    })

    await this.client.send(command)
    // 返回可访问的 URL (假设你开启了公开访问)
    return `${env.get('B2_PUBLIC_URL')}/${fileName}`
  }
}

export default new B2Service()