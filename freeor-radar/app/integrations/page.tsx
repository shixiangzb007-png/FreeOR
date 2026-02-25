'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const CODE_EXAMPLES = {
    python: `from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-v1-your-api-key-here",
)

# Use any free model from FreeOR Radar
response = client.chat.completions.create(
    model="meta-llama/llama-3.1-8b-instruct:free",
    messages=[
        {
            "role": "user",
            "content": "Hello! What can you do?"
        }
    ],
)

print(response.choices[0].message.content)`,

    javascript: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "sk-or-v1-your-api-key-here",
  defaultHeaders: {
    "HTTP-Referer": "https://your-site.com",
    "X-Title": "Your App Name",
  },
});

// Use any free model from FreeOR Radar
const response = await client.chat.completions.create({
  model: "meta-llama/llama-3.1-8b-instruct:free",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);`,

    curl: `curl https://openrouter.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer sk-or-v1-your-api-key-here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "meta-llama/llama-3.1-8b-instruct:free",
    "messages": [
      {
        "role": "user",
        "content": "Hello!"
      }
    ]
  }'`,

    aider: `# Use Aider with a free OpenRouter model
aider --model openrouter/meta-llama/llama-3.1-8b-instruct:free \\
      --openai-api-base https://openrouter.ai/api/v1 \\
      --openai-api-key sk-or-v1-your-api-key-here

# Or set via environment variables
export OPENAI_API_BASE=https://openrouter.ai/api/v1
export OPENAI_API_KEY=sk-or-v1-your-api-key-here
aider --model openrouter/meta-llama/llama-3.1-8b-instruct:free`,
};

const TABS = ['python', 'javascript', 'curl', 'aider'] as const;
type Tab = typeof TABS[number];

export default function IntegrationsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('python');
    const [copied, setCopied] = useState(false);

    function copyCode() {
        navigator.clipboard.writeText(CODE_EXAMPLES[activeTab]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">🔌 集成中心</h1>
                <p className="text-sm text-white/40 mt-1">多种语言快速接入 OpenRouter 免费模型</p>
            </div>

            {/* Quick start */}
            <div className="card-glow rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-white/80 mb-4">快速开始</h2>

                {/* Tab bar */}
                <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-5 w-fit">
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab
                                    ? 'bg-white/10 text-white shadow-sm'
                                    : 'text-white/40 hover:text-white/70'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Code block */}
                <div className="relative">
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-t-xl bg-white/5 border border-white/8 border-b-0">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/60" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                            <div className="w-3 h-3 rounded-full bg-green-500/60" />
                        </div>
                        <button
                            onClick={copyCode}
                            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-green-400 transition-colors"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? '已复制' : '复制'}
                        </button>
                    </div>
                    <pre className="bg-[#111] border border-white/8 rounded-b-xl p-5 overflow-x-auto text-sm font-mono leading-relaxed">
                        <code className="text-white/75">{CODE_EXAMPLES[activeTab]}</code>
                    </pre>
                </div>
            </div>

            {/* Model ID tips */}
            <div className="card-glow rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-white/80 mb-3">💡 获取免费模型 ID</h2>
                <p className="text-sm text-white/50 mb-4">所有免费模型 ID 均以 <code className="bg-white/10 px-1.5 py-0.5 rounded text-green-400">:free</code> 结尾</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        { name: 'Llama 3.1 8B', id: 'meta-llama/llama-3.1-8b-instruct:free' },
                        { name: 'DeepSeek R1', id: 'deepseek/deepseek-r1:free' },
                        { name: 'Gemma 3 27B', id: 'google/gemma-3-27b-it:free' },
                        { name: 'Qwen 2.5 72B', id: 'qwen/qwen-2.5-72b-instruct:free' },
                    ].map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/8">
                            <div>
                                <div className="text-sm font-medium text-white/80">{m.name}</div>
                                <div className="text-xs text-white/30 font-mono mt-0.5">{m.id}</div>
                            </div>
                            <button
                                onClick={() => navigator.clipboard.writeText(m.id)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-green-400 transition-all ml-3"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-white/25 mt-3">前往仪表盘查看 {'->'} 完整免费模型列表（含 :free 标签）</p>
            </div>
        </div>
    );
}
