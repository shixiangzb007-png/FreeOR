'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useLang } from '@/lib/i18n/lang-context';

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

    clawdbot: `# Clawdbot — config.yaml
# Point the OpenAI-compatible provider at OpenRouter and pick any :free model.
provider:
  name: openrouter
  base_url: https://openrouter.ai/api/v1
  api_key: \${OPENROUTER_API_KEY}   # export OPENROUTER_API_KEY=sk-or-v1-...

model: meta-llama/llama-3.1-8b-instruct:free

# Optional attribution headers (recommended by OpenRouter)
headers:
  HTTP-Referer: https://your-site.com
  X-Title: Clawdbot

# Run:
#   export OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
#   clawdbot --config config.yaml`,

    openclaw: `// OpenClaw — openclaw.config.json
// OpenClaw speaks the OpenAI Chat Completions protocol, so just swap the endpoint.
{
  "llm": {
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKey": "\${OPENROUTER_API_KEY}",
    "model": "meta-llama/llama-3.1-8b-instruct:free",
    "headers": {
      "HTTP-Referer": "https://your-site.com",
      "X-Title": "OpenClaw"
    }
  }
}

// Run:
//   export OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
//   openclaw start --config openclaw.config.json`,
};

const TABS = ['python', 'javascript', 'curl', 'aider', 'clawdbot', 'openclaw'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
    python: 'Python',
    javascript: 'JavaScript',
    curl: 'cURL',
    aider: 'Aider',
    clawdbot: 'Clawdbot',
    openclaw: 'OpenClaw',
};

export default function IntegrationsPage() {
    const { t } = useLang();
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
                <h1 className="text-2xl font-bold text-white">{t('integrations.title')}</h1>
                <p className="text-sm text-white/40 mt-1">{t('integrations.subtitle')}</p>
            </div>

            {/* Quick start */}
            <div className="card-glow rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-white/80 mb-4">{t('integrations.quickstart')}</h2>

                {/* Tab bar */}
                <div className="flex flex-wrap gap-1 p-1 bg-white/5 rounded-xl mb-5 w-fit max-w-full">
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                                    ? 'bg-white/10 text-white shadow-sm'
                                    : 'text-white/40 hover:text-white/70'
                                }`}
                        >
                            {TAB_LABELS[tab]}
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
                            {copied ? t('integrations.copied') : t('integrations.copy')}
                        </button>
                    </div>
                    <pre className="bg-[#111] border border-white/8 rounded-b-xl p-5 overflow-x-auto text-sm font-mono leading-relaxed">
                        <code className="text-white/75">{CODE_EXAMPLES[activeTab]}</code>
                    </pre>
                </div>
            </div>

            {/* Model ID tips */}
            <div className="card-glow rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-white/80 mb-3">{t('integrations.models.title')}</h2>
                <p className="text-sm text-white/50 mb-4">
                    {t('integrations.models.desc')} <code className="bg-white/10 px-1.5 py-0.5 rounded text-green-400">:free</code>
                </p>
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
                <p className="text-xs text-white/25 mt-3">{t('integrations.models.hint')}</p>
            </div>
        </div>
    );
}
