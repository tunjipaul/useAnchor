# useAnchor — Privacy Policy (Draft)

> **Important note before using this document:** This is a starting draft, not a finished legal document. useAnchor collects location and personal contact data — get this reviewed by a lawyer familiar with Nigerian data protection law (NDPR) before publishing. Treat this as a structural first pass you can hand to counsel, not a final artifact.

**Last updated: [Date]**

## 1. What This Policy Covers

This Privacy Policy explains what personal data useAnchor collects, why, how it is used, and how you can control it. useAnchor is built around minimal data collection — we only collect what is necessary to make the safety features work.

## 2. Data We Collect

### Account Data
- Full name
- Phone number
- Profile photo (optional)

### Trusted Contact Data
- Name and phone number of each trusted contact you add
- Relationship status (pending, accepted, declined, removed)

### Session Data
- Session title, meetup person's name/alias, and optional phone number
- Meetup location (text and/or coordinates)
- Expected return time and session notes you choose to enter

### Location Data
- Your device's GPS coordinates, collected **only while an Anchor Session is active**
- Cached periodically to allow immediate location sharing during an SOS, without waiting for a fresh GPS fix
- Location tracking stops the moment a session ends

### Alert & Incident Data
- Timestamp, trigger type, and location of any SOS or missed check-in alert
- Delivery status of notifications sent to trusted contacts

### Technical Data
- Device push notification token (for delivering alerts)
- Basic usage logs for debugging and security (e.g. login timestamps)

## 3. What We Do Not Collect

- We do not track your location outside of an active Anchor Session.
- We do not sell your data to advertisers or third parties.
- We do not use your data to build advertising profiles.
- We do not access your contacts list automatically — you manually add trusted contacts.

## 4. How We Use Your Data

| Data | Purpose |
|---|---|
| Phone number | Account authentication (OTP login) |
| Trusted contact info | Delivering alerts during an SOS or missed check-in |
| Session details | Giving trusted contacts context if an alert is triggered |
| Location data | Sharing your position with trusted contacts during an emergency |
| Push token | Delivering push notifications for check-ins and alerts |

## 5. Who Can See Your Data

- **You** can see all of your own session, contact, and account data.
- **Trusted contacts** can see session and location details **only** after you trigger an alert (SOS or missed check-in) that involves them — not before, and not outside of an active incident.
- **useAnchor staff** do not routinely access your personal data. Limited access may occur for debugging, security investigations, or legal compliance, and is logged.
- We do not share your data with third parties for marketing purposes.

## 6. Third-Party Services We Use

useAnchor relies on the following third-party infrastructure providers to operate:

- **Supabase** — database hosting, authentication, and backend infrastructure
- **TextLocal** (development/production SMS provider for OTP delivery; may transition to Twilio or Termii)
- **Firebase Cloud Messaging** — push notification delivery

These providers process data strictly to perform the technical function described (e.g. sending an SMS, delivering a push notification) and are not permitted to use your data for their own purposes.

## 7. Data Retention

- Session data is retained so you can view your session history, unless you delete it manually.
- You may delete individual sessions or your entire account at any time.
- Deleted data is removed from active systems within [X days] and from backups within [X days] (fill in based on final backend retention policy).

## 8. Your Rights

Depending on your location, you may have the right to:

- Access the personal data we hold about you
- Correct inaccurate data
- Request deletion of your data
- Withdraw consent for data collection (which may limit app functionality, e.g. disabling location sharing)

To exercise these rights, contact: [support email]

## 9. Data Security

- All data is encrypted in transit (HTTPS/TLS).
- Access to the database is restricted via Row Level Security — users can only access their own data, and trusted contacts can only access alert data explicitly shared with them.
- Sensitive credentials (API keys, service tokens) are never exposed to the frontend application.

## 10. Children's Privacy

useAnchor is not directed at children under 13. We do not knowingly collect data from children under 13. If you believe a child has created an account, contact us and we will remove the account and associated data.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. Material changes affecting how your data is used will be communicated to you before they take effect.

## 12. Contact

Questions about this Privacy Policy or your data can be sent to: [support email]

---

## Notes for Legal Review (Delete Before Publishing)

- [ ] Confirm NDPR (Nigeria Data Protection Regulation) compliance language is sufficient, or expand Section 8/9 accordingly
- [ ] Confirm data retention periods (Section 7) with actual backend policy once finalized
- [ ] Consider whether GDPR language is needed if targeting any EU users
- [ ] Add actual support email and company/entity name throughout.
