export interface Event {
  id: string;
  title: string;
  description: string;
  event_date: string;
  responsible_member: string | null;
  lei_responsible: string | null;
  public_token: string;
  /** Email of the organiser who created the event (null for older events) */
  created_by: string | null;
  /** When the printed list was put into the office folder (null: not yet) */
  filed_at: string | null;
  /** Email of the organiser who marked it as filed */
  filed_by: string | null;
  /** When the creator signed the list off; closes the event for sign-ins */
  signed_off_at: string | null;
  /** Email of the organiser who signed it off */
  signed_off_by: string | null;
  /** The organiser's signature, a small PNG data URL like participants' */
  organiser_signature: string | null;
  created_at: string;
}

/** What the public attendance form may know about an event (get_public_event). */
export type PublicEvent = Pick<Event, "id" | "title" | "description" | "event_date"> & {
  /** Signed off: no more sign-ins */
  closed: boolean;
};

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
  /** Signature as a small PNG data URL ("data:image/png;base64,…") */
  signature: string;
  /** "self" (own phone) | "kiosk" (signed in on an organiser's device) */
  entry_method: "self" | "kiosk";
  /** Email of the organiser whose device recorded a kiosk sign-in */
  recorded_by: string | null;
  /** Version (date) of the consent text agreed to; null for sign-ins before consent */
  consent_version: string | null;
  created_at: string;
}

/** Legal texts the attendance form shows, as HTML rendered from legal/*.md. */
export interface FormTexts {
  disclaimer: string;
  dataProcessing: string;
  /** The consent checkbox label (inline HTML) */
  consent: string;
}

export interface EventWithParticipants extends Event {
  participants: Participant[];
}
