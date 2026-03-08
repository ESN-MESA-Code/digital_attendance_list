export interface Event {
  id: string;
  title: string;
  description: string;
  event_date: string;
  public_token: string;
  created_at: string;
}

export interface Participant {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  organization: string | null;
  signature_url: string | null;
  created_at: string;
}

export interface EventWithParticipants extends Event {
  participants: Participant[];
}
