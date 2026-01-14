import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import env from '#start/env'

class B2Service {
  // 使用 S3 协议兼容模式连接 Backblaze B2
  private client = new S3Client({
    endpoint: env.get('B2_ENDPOINT'), 
    region: env.get('B2_REGION'),
    credentials: {
      accessKeyId: env.get('B2_KEY_ID'),
      secretAccessKey: env.get('B2_APPLICATION_KEY'),
    },
  })

  async upload(buffer: Buffer, key: string) {
    await this.client.send(new PutObjectCommand({
      Bucket: env.get('B2_BUCKET'),
      Key: key,
      Body: buffer,
      ContentType: 'image/webp',
      // 如果需要公开访问，部分桶可能需要配置 ACL，通常 B2 靠桶权限控制
    }))

    // 拼接最终的公开访问链接
    return `${env.get('B2_PUBLIC_URL')}/${key}`
  }
}

export default new B2Service()