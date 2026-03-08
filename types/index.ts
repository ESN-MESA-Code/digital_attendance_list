export interface Event {
  id: string;
  title: string;
  description: string;
  event_date: string;
  responsible_member: string | null;
  lei_responsible: string | null;
  public_token: string;
  created_at: string;
}

export interface Participant {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  nationality: string | null;
  /** "LMU" | "TUM" | "Other" */
  university: string | null;
  /** "Erasmus+" | "LMUexchange" | "Full-time degree" | "Other" */
  exchange_program: string | null;
  esn_card: boolean | null;
  signature_url: string | null;
  created_at: string;
}

export interface EventWithParticipants extends Event {
  participants: Participant[];
}
