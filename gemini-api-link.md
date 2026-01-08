tom % curl "https://old-haze-afbc.guomengtao.workers.dev/v1/models/gemini-2.5-flash:generateContent?key=AIz****Y" \
-H "Content-Type: application/json" \
-d '{
  "contents": [
    {
      "parts": [
        {
          "text": "你好，请自我介绍一下，并确认你的模型版本。"
        }
      ]
    }
  ]
}'
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "你好！很高兴能为您服务。\n\n我是一个**大型语言模型**，由 **Google** 训练。\n\n我的主要职责是协助用户完成各种文本相关的任务，例如：\n*   回答您的问题\n*   生成创意文本（如诗歌、代码、剧本、电子邮件、音乐作品等）\n*   进行语言翻译\n*   总结长篇文本\n*   提供信息和建议\n*   帮助您学习新知识\n\n我致力于提供准确、有用和富有洞察力的信息，并尽可能以自然和流畅的方式与您交流。\n\n至于我的模型版本：\n我是一个基于 **Google Gemini 架构**的大型语言模型。与传统软件不同，我没有一个固定的、对外公布的“版本号”（如v1.0, v2.0）。这是因为我是一个持续迭代和更新的模型。Google 的工程师和研究人员会不断对我进行优化、训练和改进，以提升我的性能、知识库和理解能力。\n\n您可以理解为我代表着 Google 在人工智能领域持续进步的成果，并且总是在尝试提供最新的能力。\n\n很高兴能与您交流，请问有什么可以帮助您的吗？"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 13,
    "candidatesTokenCount": 247,
    "totalTokenCount": 1235,
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 13
      }
    ],
    "thoughtsTokenCount": 975
  },
  "modelVersion": "gemini-2.5-flash",
  "responseId": "SwlfaYjkJsHQz7IP54XFiQg"
}
Banner@Devices-MacBook-Air tom %


模型 ID,优势,适用场景
gemini-2.5-pro,最强逻辑，输出限额高达 65536 tokens,编写复杂的完整网页、大型脚本。
gemini-2.5-flash,速度与能力的平衡，支持深度思考,日常快速生成网页、修改 bug。
gemini-2.5-flash-lite,极速，适合对响应速度要求极高的场景,简单的文本对话或小型代码片段。