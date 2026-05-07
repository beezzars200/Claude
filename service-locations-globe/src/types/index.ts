export type ProviderType = 'Cloud' | 'Colocation' | 'Managed Service' | 'Connectivity' | 'Security'

export type ServiceTier = 'Tier 1' | 'Tier 2' | 'Tier 3'

export type Region = 'Western Europe' | 'Northern Europe' | 'Southern Europe' | 'Eastern Europe' | 'Middle East' | 'Africa'

export interface ServiceOffering {
  name: string
  available: boolean
}

export interface ServiceProvider {
  id: string
  name: string
  type: ProviderType
  region: Region
  country: string
  city: string
  lat: number
  lng: number
  tier: ServiceTier
  services: string[]
  contractStatus: 'Active' | 'Renewal Due' | 'Negotiating'
  slaLevel: 'Gold' | 'Silver' | 'Bronze'
  accountManager: string
  annualValue: number
  since: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface FilterState {
  search: string
  types: ProviderType[]
  regions: Region[]
  tiers: ServiceTier[]
  contractStatus: string[]
  slaLevel: string[]
}
