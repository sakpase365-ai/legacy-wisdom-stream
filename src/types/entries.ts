export type Domain =
  | 'relationships'
  | 'finances'
  | 'resilience'
  | 'career'
  | 'identity'
  | 'faith'
  | 'health';

export type DeliveryType = 'age-locked' | 'milestone' | 'evergreen';

export interface Entry {
  id: string;
  parent_id: string;
  child_name: string;
  content: string;
  follow_up?: string;
  domain: Domain;
  relevant_age: number;
  delivery_type: DeliveryType;
  summary: string;
  created_at: string;
  delivered_at?: string;
}

export interface ParentProfile {
  id: string;
  name: string;
  child_name: string;
  child_dob: string; // ISO date
  created_at: string;
}
