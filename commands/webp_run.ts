import { BaseCommand } from '@adonisjs/core/ace'
import Case from '#models/case'
import sharp from 'sharp'
import axios from 'axios'
import B2Service from '#services/b2_service'

export default class ProcessImages extends BaseCommand {
  static commandName = 'webp:run'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动 B2 全自动图片流水线...')

    try {
      // 1. 捞出待处理数据 (每次 50 条，防止内存溢出)
      const records = await Case.query()
        .where('image_webp_status', 0)
        .whereNotNull('case_html')
        .limit(50)

      if (records.length === 0) {
        this.logger.success('✅ 所有任务已处理完成！')
        return
      }

      for (const record of records) {
        this.logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        this.logger.info(`📂 正在处理案件: ${record.caseId}`)

        // 2. 使用宽泛正则提取所有图片链接
        const htmlContent = record.caseHtml || ''

        
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
        const urls = [...htmlContent.matchAll(imgRegex)]
          .map((m) => m[1])
          .filter(url => /\.(jpg|jpeg|png|gif|webp)/i.test(url))

        if (urls.length === 0) {
          this.logger.warning('⚠️ 无图片链接，跳过。')
          record.imageWebpStatus = 1
          await record.save()
          continue
        }

        let successCount = 0
        for (let i = 0; i < urls.length; i++) {
          const rawUrl = urls[i]
          try {
            this.logger.info(`  [${i + 1}/${urls.length}] 📥 下载中...`)
            
            // 3. 内存转换流程
            const response = await axios.get(rawUrl, { 
              responseType: 'arraybuffer', 
              timeout: 20000 
            })

            this.logger.info(`  [${i + 1}/${urls.length}] 🪄 转 WebP 并上传 B2...`)
            const webpBuffer = await sharp(Buffer.from(response.data))
              .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer()

            // 4. 定义云端路径 (例如: cases/estelle-lois-abbott/1.webp)
            const cloudKey = `cases/${record.caseId}/${i + 1}.webp`
            const publicUrl = await B2Service.upload(webpBuffer, cloudKey)

            this.logger.success(`  └─ ✅ 成功: ${publicUrl}`)
            successCount++
          } catch (err) {
            this.logger.error(`  └─ ❌ 失败 [${rawUrl.substring(0, 30)}]: ${err.message}`)
          }
        }

        // 5. 回写状态
        record.imageWebpStatus = 1
        record.imageCount = successCount
        await record.save()
        this.logger.info(`🎉 案件 ${record.caseId} 完成，成功 ${successCount} 张。`)
      }
    } catch (error) {
      this.logger.error(`🚨 系统崩溃: ${error.message}`)
    }
  }
}