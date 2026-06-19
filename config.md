---
title: Apple Music 服务配置
description: 配置 Apple Music 服务的默认参数
fields:
  - key: base.mediaUserToken
    label: 默认 Media User Token
    type: secret
    description: Apple Music 下载高质量 AAC 必需 token，无 token 仅能下载 30s 音频
    placeholder: eyJ...

  - key: base.storefront
    label: 默认 Storefront
    type: text
    description: 地区代码，例如 cn、us、jp
    placeholder: cn

  - key: base.language
    label: 默认语言
    type: text
    description: 语言代码，例如 zh-CN、en-US
    placeholder: zh-CN
---
