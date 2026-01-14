// 伪代码流程
for (const record of records) {
  const urls = extractUrls(record.caseHtml) // 使用刚才调优好的正则

  for (const [index, url] of urls.entries()) {
    // 1. 下载
    const source = await axios.get(url, { responseType: 'arraybuffer' })
    
    // 2. 转换 (内存操作，不占硬盘)
    const webpBuffer = await sharp(source.data).webp().toBuffer()
    
    // 3. 上传到 B2
    const cloudPath = `cases/${record.caseId}/photo_${index + 1}.webp`
    const publicUrl = await B2Service.upload(webpBuffer, cloudPath)
    
    // 4. 存入数据库
    await ImageModel.create({
      caseId: record.caseId,
      url: publicUrl
    })
  }
  
  // 5. 标记主表完成
  record.imageWebpStatus = 1
  await record.save()
}