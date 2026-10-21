// The facts the legal texts share (association, DPO, retention, consent
// version). They live with the texts in legal/details.json – edit them there.
import details from "../legal/details.json";

export const LEGAL = details;

/**
 * Version (date) of the consent text on the attendance form, stored with each
 * sign-in so we can show what a participant agreed to (Art. 7(1) GDPR).
 * Bump it in legal/details.json whenever the consent text changes in substance.
 */
export const CONSENT_VERSION = details.consent_version;
