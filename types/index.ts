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
  /** ISO 3166-1 alpha-2 code, e.g. "DE" – show it with countryName() */
  nationality: string;
  /** "LMU" | "TUM" | "Other" */
  university: string;
  /** "Erasmus+" | "LMUexchange" | "Full-time degree" | "Other" */
  exchange_program: string;
  esn_card: boolean;
  signature_url: string;
  /** "self" (own phone) | "kiosk" (signed in on an organiser's device) */
  entry_method: "self" | "kiosk";
  /** Email of the organiser whose device recorded a kiosk sign-in */
  recorded_by: string | null;
  created_at: string;
}

export interface EventWithParticipants extends Event {
  participants: Participant[];
}
