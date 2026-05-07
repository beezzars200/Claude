import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles } from 'lucide-react'
import type { ChatMessage, FilterState, ServiceProvider } from '../types'
import { providers as allProviders } from '../data/providers'

interface Props {
  onFilter: (state: Partial<FilterState>) => void
  onHighlight: (ids: Set<string>) => void
  onSelect: (p: ServiceProvider | null) => void
}

// ---------------------------------------------------------------------------
// Claude endpoint adapter — swap endpoint/headers for your internal instance
// ---------------------------------------------------------------------------
async function queryAI(
  userMessage: string,
  context: string,
): Promise<string> {
  // TODO: Replace with your internal Claude endpoint
  // Example internal endpoint:
  // const res = await fetch('https://internal-claude.yourcompany.com/v1/messages', {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${YOUR_TOKEN}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 512, messages: [
  //     { role: 'user', content: `${context}\n\n${userMessage}` }
  //   ]}),
  // })
  // const data = await res.json()
  // return data.content[0].text

  // --- Local fallback: rule-based semantic filter (no external calls) ---
  return localSemanticResponse(userMessage, context)
}

// ---------------------------------------------------------------------------
// Local rule-based responder — no network, works offline
// ---------------------------------------------------------------------------
function localSemanticResponse(query: string, _context: string): string {
  const q = query.toLowerCase()

  // Extract counts for context
  const cloudCount = allProviders.filter(p => p.type === 'Cloud').length
  const renewalCount = allProviders.filter(p => p.contractStatus === 'Renewal Due').length
  const goldCount = allProviders.filter(p => p.slaLevel === 'Gold').length
  const meaCount = allProviders.filter(p => ['Middle East', 'Africa'].includes(p.region)).length
  const totalValue = allProviders.reduce((s, p) => s + p.annualValue, 0)

  if (q.includes('renewal') || q.includes('expir')) {
    const names = allProviders
      .filter(p => p.contractStatus === 'Renewal Due')
      .map(p => p.name)
      .join(', ')
    return `${renewalCount} providers are up for renewal: ${names}. I've highlighted them on the globe and filtered the matrix.`
  }

  if (q.includes('gold') || (q.includes('sla') && q.includes('gold'))) {
    return `There are ${goldCount} Gold SLA providers. These are your highest-priority relationships — I've highlighted them now.`
  }

  if ((q.includes('middle east') || q.includes('mea') || q.includes('africa'))) {
    return `You have ${meaCount} providers across the Middle East and Africa. I've filtered the view to show them.`
  }

  if (q.includes('cloud')) {
    return `There are ${cloudCount} cloud providers across EMEA. I've filtered to show cloud providers on the globe and matrix.`
  }

  if (q.includes('colocation') || q.includes('colo')) {
    const count = allProviders.filter(p => p.type === 'Colocation').length
    return `${count} colocation providers are active across EMEA. Filtered view applied.`
  }

  if (q.includes('value') || q.includes('spend') || q.includes('cost') || q.includes('budget')) {
    const fmtM = (n: number) => `£${(n / 1_000_000).toFixed(1)}M`
    const topP = [...allProviders].sort((a, b) => b.annualValue - a.annualValue).slice(0, 3)
    return `Total EMEA portfolio value is ${fmtM(totalValue)} annually. Top 3 by value: ${topP.map(p => `${p.name} (${fmtM(p.annualValue)})`).join(', ')}.`
  }

  if (q.includes('negotiat')) {
    const names = allProviders
      .filter(p => p.contractStatus === 'Negotiating')
      .map(p => p.name)
      .join(', ')
    return `${allProviders.filter(p => p.contractStatus === 'Negotiating').length} provider(s) currently in negotiation: ${names}.`
  }

  if (q.includes('tier 1') || q.includes('tier1')) {
    const count = allProviders.filter(p => p.tier === 'Tier 1').length
    return `${count} Tier 1 providers (highest classification). Filtered to show them now.`
  }

  if (q.includes('uk') || q.includes('united kingdom') || q.includes('london')) {
    const uk = allProviders.filter(p => p.country === 'United Kingdom')
    return `${uk.length} providers in the UK: ${uk.map(p => p.name).join(', ')}.`
  }

  if (q.includes('how many') || q.includes('count') || q.includes('total')) {
    return `There are ${allProviders.length} service providers mapped across EMEA, spanning ${new Set(allProviders.map(p => p.country)).size} countries and 6 sub-regions.`
  }

  if (q.includes('clear') || q.includes('reset') || q.includes('show all')) {
    return `Filters cleared — showing all ${allProviders.length} providers across EMEA.`
  }

  return `I can help you filter and explore the ${allProviders.length} EMEA providers. Try asking: "show me renewal due providers", "filter by cloud", "what's our MEA footprint", or "show Gold SLA partners".`
}

// ---------------------------------------------------------------------------
// Parse the AI response and derive filter actions
// ---------------------------------------------------------------------------
function deriveFilterActions(
  query: string,
  response: string,
): { filter: Partial<FilterState>; highlight: Set<string> } {
  const q = query.toLowerCase()
  const filter: Partial<FilterState> = {}
  let highlight = new Set<string>()

  if (q.includes('clear') || q.includes('reset') || q.includes('show all')) {
    return { filter: { types: [], regions: [], tiers: [], contractStatus: [], slaLevel: [] }, highlight }
  }

  if (q.includes('renewal') || q.includes('expir')) {
    filter.contractStatus = ['Renewal Due']
    highlight = new Set(allProviders.filter(p => p.contractStatus === 'Renewal Due').map(p => p.id))
  } else if (q.includes('negotiat')) {
    filter.contractStatus = ['Negotiating']
    highlight = new Set(allProviders.filter(p => p.contractStatus === 'Negotiating').map(p => p.id))
  } else if (q.includes('gold')) {
    filter.slaLevel = ['Gold']
    highlight = new Set(allProviders.filter(p => p.slaLevel === 'Gold').map(p => p.id))
  } else if (q.includes('middle east') || q.includes('mea') || q.includes('africa')) {
    filter.regions = ['Middle East', 'Africa']
  } else if (q.includes('cloud')) {
    filter.types = ['Cloud']
  } else if (q.includes('colocation') || q.includes('colo')) {
    filter.types = ['Colocation']
  } else if (q.includes('connectivity')) {
    filter.types = ['Connectivity']
  } else if (q.includes('managed service')) {
    filter.types = ['Managed Service']
  } else if (q.includes('tier 1') || q.includes('tier1')) {
    filter.tiers = ['Tier 1']
  }

  return { filter, highlight }
}

const SUGGESTIONS = [
  'Show renewal due providers',
  'Filter by Cloud type',
  'What is our MEA footprint?',
  'Highlight Gold SLA partners',
  'Show all Tier 1 providers',
  'Total portfolio value?',
]

export default function ChatPanel({ onFilter, onHighlight, onSelect }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Welcome! I can help you explore your EMEA service provider landscape. Ask me to filter by type, region, SLA level, contract status — or just ask a question about the portfolio.\n\nConnect me to your internal Claude endpoint in \`src/components/ChatPanel.tsx\` to enable full natural language queries.`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const query = (text ?? input).trim()
    if (!query || loading) return
    setInput('')

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const context = `You are an assistant for an EMEA service provider management tool. There are ${allProviders.length} providers.`
      const response = await queryAI(query, context)

      const { filter, highlight } = deriveFilterActions(query, response)
      onFilter(filter)
      onHighlight(highlight)

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0a0e1a',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <Sparkles size={14} color="#4f9cf9" />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>AI Assistant</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 10,
          color: '#4b5563',
          background: 'rgba(255,255,255,0.04)',
          padding: '2px 8px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>Local mode</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: msg.role === 'user' ? '#1e3a5f' : '#1a2035',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {msg.role === 'user'
                ? <User size={12} color="#94a3b8" />
                : <Bot size={12} color="#4f9cf9" />}
            </div>
            <div style={{
              maxWidth: '82%',
              background: msg.role === 'user' ? '#1e3a5f' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: msg.role === 'user' ? '10px 2px 10px 10px' : '2px 10px 10px 10px',
              padding: '8px 12px',
              fontSize: 12,
              color: '#cbd5e1',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: '#1a2035', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <Bot size={12} color="#4f9cf9" />
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '2px 10px 10px 10px',
              padding: '10px 14px',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#4f9cf9',
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div style={{
        padding: '8px 14px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => send(s)}
            style={{
              fontSize: 11, padding: '3px 8px',
              background: 'rgba(79,156,249,0.08)',
              border: '1px solid rgba(79,156,249,0.18)',
              borderRadius: 12,
              color: '#64a7e0',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >{s}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        gap: 8,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about providers, filters, regions..."
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#e2e8f0',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{
            background: input.trim() && !loading ? '#4f9cf9' : 'rgba(255,255,255,0.06)',
            border: 'none',
            borderRadius: 8,
            padding: '0 12px',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            color: input.trim() && !loading ? '#fff' : '#4b5563',
            transition: 'background 0.15s',
            display: 'flex', alignItems: 'center',
          }}
        >
          <Send size={14} />
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
