// app/models/case.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Case extends BaseModel {
  // 必须和 D1 里的表名一模一样
  public static table = 'missing_persons_cases'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare caseTitle: string

  @column()
  declare caseId: string

  @column()
  declare imageWebpStatus: number
  imageCount: number
}