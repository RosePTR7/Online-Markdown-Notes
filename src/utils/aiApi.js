export const polishMarkdown = async (content, baseUrl, apiKey) => {
  if (!baseUrl || !apiKey) throw new Error('请先配置AI接口地址和密钥')
  if (!content?.trim()) throw new Error('笔记内容不能为空，无法润色')

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是专业笔记润色助手,只优化语句通顺度、逻辑排版,严格保留原有Markdown所有格式、标题、列表、代码块，只返回处理后的纯Markdown内容，不要额外解释'
        },
        { role: 'user', content: content }
      ]
    })
  })

  if (!res.ok) {
    throw new Error(`接口请求失败，状态码：${res.status}`)
  }
  const data = await res.json()

  if (!data?.choices?.length) {
    throw new Error('AI接口返回数据格式异常,无润色结果')
  }

  return data.choices[0].message.content
}