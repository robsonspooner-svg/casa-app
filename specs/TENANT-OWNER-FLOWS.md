# Tenant-Owner Interaction Flows

> Comprehensive map of all data flows and interactions between tenants and owners in the Casa platform.
> This document serves as the source of truth for tenant-landlord flows across all missions.

---

## Overview

Casa facilitates 67+ distinct interaction flows between tenants and owners. These flows span:
- Property discovery and application
- Tenancy creation and management
- Rent collection and payments
- Maintenance and repairs
- Communications and notifications
- Inspections and compliance

---

## Flow Categories

### 1. Application & Onboarding (Missions 04-06)

| Flow | Trigger | Tenant Action | Owner Action | Status |
|------|---------|---------------|--------------|--------|
| Search listings | Tenant opens app | Browse/filter listings | N/A | Implemented |
| View listing | Tap listing card | View photos, details | View count tracked | Implemented |
| Submit application | Tap "Apply Now" | Complete 6-step wizard | Receive notification | Implemented |
| Review application | Application submitted | N/A | View applicant details | Implemented |
| Shortlist applicant | Owner action | Notified of status | Mark as shortlisted | Implemented |
| Approve/reject | Owner decision | Notified of outcome | Update status | Implemented |
| Create tenancy | Application approved | N/A | Fill lease details | Implemented |
| Sign lease | Lease generated | Digital signature | Digital signature | Gateway ready |
| Lodge bond | Lease signed | N/A | Submit to authority | Gateway ready |

### 2. Rent Collection (Mission 07)

| Flow | Trigger | Tenant Action | Owner Action | Status |
|------|---------|---------------|--------------|--------|
| View rent schedule | Tenancy active | See upcoming payments | N/A | Implemented |
| Add payment method | Tenant setup | Enter card/bank details | N/A | Implemented |
| Pay rent | Due date | One-tap payment | Receive notification | Implemented |
| Enable auto-pay | Tenant preference | Toggle auto-pay | N/A | Implemented |
| Auto-pay execution | Due date + auto-pay | Automatic charge | Receive funds | Implemented |
| Payment failed | Declined | Retry prompt | Alert notification | Implemented |
| View payment history | Any time | See all payments | See all receipts | Implemented |
| Configure payouts | Owner setup | N/A | Set payout frequency | Implemented |
| Process refund | Owner action | Receive refund | Initiate refund | Implemented |

### 3. Arrears Management (Mission 08)

| Flow | Trigger | Tenant Action | Owner Action | Status |
|------|---------|---------------|--------------|--------|
| Arrears detected | Rent overdue | Alert in app | Dashboard alert | **Gateway ready** |
| Friendly reminder | Day 1 overdue | Receive email | Automatic | **Gateway ready** |
| Formal reminder | Day 7 overdue | Receive notice | Review dashboard | **Gateway ready** |
| Final warning | Day 14 overdue | Receive warning | Alert + action options | **Gateway ready** |
| Create payment plan | Owner offer | Accept/review terms | Set installments | **Gateway ready** |
| Breach notice | Day 21+ | Receive legal notice | Generate & send | **Gateway ready** |
| View arrears status | Any time | See what's owed | See all arrears | **Gateway ready** |

### 4. Maintenance Requests (Mission 09)

| Flow | Trigger | Tenant Action | Owner Action | Status |
|------|---------|---------------|--------------|--------|
| Submit request | Issue discovered | Fill form + photos | Receive notification | **Gateway ready** |
| Emergency alert | Urgency=emergency | Submit request | Immediate SMS | **Gateway ready** |
| Acknowledge request | Owner action | Status update | Confirm receipt | **Gateway ready** |
| Request quote | Complex issue | N/A | Request tradesperson quote | **Gateway ready** |
| Schedule repair | Quote approved | Confirm access | Set date/time | **Gateway ready** |
| Job in progress | Tradesperson arrives | N/A | Track status | **Gateway ready** |
| Job completed | Repair done | Rate satisfaction | Review cost/photos | **Gateway ready** |
| Add photos/comments | Any time | Upload to thread | View/respond | **Gateway ready** |

### 5. Tradesperson Network (Mission 10)

| Flow | Trigger | Tenant Action | Owner Action | Status |
|------|---------|---------------|--------------|--------|
| Create work order | Maintenance approved | N/A | Assign tradesperson | **Gateway ready** |
| Submit quote | Trade response | N/A | Review quote | **Gateway ready** |
| Approve quote | Owner decision | N/A | Approve/reject | **Gateway ready** |
| Job scheduling | Quote approved | Confirm access | Coordinate time | **Gateway ready** |
| Check-in/out | Trade arrives | N/A | Track time | **Gateway ready** |
| Submit invoice | Job complete | N/A | Review & pay | **Gateway ready** |
| Write review | Payment done | N/A | Rate tradesperson | **Gateway ready** |

### 6. Property Inspections (Mission 11)

| Flow | Trigger | Tenant Action | Owner Action | Status |
|------|---------|---------------|--------------|--------|
| Schedule inspection | Owner/system | Receive notice (14 days) | Set date/time | **Gateway ready** |
| Entry inspection | Move-in | Document condition | Record with photos | **Gateway ready** |
| Sign condition report | Entry complete | Digital signature | Digital signature | **Gateway ready** |
| Routine inspection | 3-6 month interval | Allow access | Conduct inspection | **Gateway ready** |
| Exit inspection | Move-out | Be present | Compare to entry | **Gateway ready** |
| AI comparison | Exit complete | View findings | Review AI flags | **Gateway ready** |
| Bond deduction | Damage found | Dispute option | Claim from bond | **Gateway ready** |
| View reports | Any time | See all reports | See all reports | **Gateway ready** |

### 7. In-App Communications (Mission 12)

| Flow | Trigger | Tenant Action | Owner Action | Status |
|------|---------|---------------|--------------|--------|
| Start conversation | Either party | Send message | Send message | **Gateway ready** |
| Reply to message | New message | Respond | Respond | **Gateway ready** |
| Attach photo/doc | In conversation | Upload file | Upload file | **Gateway ready** |
| Real-time delivery | Message sent | Instant receipt | Instant receipt | **Gateway ready** |
| Typing indicator | Composing | See indicator | See indicator | **Gateway ready** |
| Use template | Owner action | N/A | Insert template | **Gateway ready** |
| PM transition | New management | Receive welcome | Send introduction | **Gateway ready** |

### 8. AI Agent (Mission 14)

| Flow | Trigger | Tenant Action | Owner Action | Status |
|------|---------|---------------|--------------|--------|
| Chat with agent | Tap FAB | Ask questions | Ask questions | **Gateway ready** |
| Query data | Natural language | N/A | "How much does John owe?" | **Gateway ready** |
| Trigger workflow | Complex request | N/A | "Find me a tenant" | **Gateway ready** |
| Approve action | Agent needs permission | N/A | One-tap approval | **Gateway ready** |
| View suggestions | Proactive insight | N/A | Review recommendations | **Gateway ready** |

### 9. Notifications (Mission 17)

| Flow | Trigger | Tenant Action | Owner Action | Status |
|------|---------|---------------|--------------|--------|
| Push notification | Event occurs | Tap to open | Tap to open | **Gateway ready** |
| Email fallback | Unread after 30min | Receive email | Receive email | **Gateway ready** |
| Configure preferences | User setting | Toggle per type | Toggle per type | **Gateway ready** |
| Set quiet hours | User setting | Set time range | Set time range | **Gateway ready** |
| View notification center | Tap bell icon | See all alerts | See all alerts | **Gateway ready** |

---

## Gateway Implementation Status

### Implemented & Functional
These flows are fully working and can be tested end-to-end:

- ✅ Listing search and discovery
- ✅ Application submission (6-step wizard)
- ✅ Application review and approval
- ✅ Tenancy creation from approved application
- ✅ **Rent schedule generation** (just implemented)
- ✅ Payment method management
- ✅ Rent payment processing
- ✅ Auto-pay configuration
- ✅ Subscription management
- ✅ Add-on purchases

### Gateway Ready (Hooks Created)
These flows have gateway hooks that define the interface but need Mission implementation:

- 🔶 Mission 08: Arrears Management (`useArrearsGateway`)
- 🔶 Mission 09: Maintenance Requests (`useMaintenanceGateway`)
- 🔶 Mission 10: Tradesperson Network (`useTradesGateway`)
- 🔶 Mission 11: Property Inspections (`useInspectionsGateway`)
- 🔶 Mission 12: In-App Communications (`useMessagesGateway`)
- 🔶 Mission 14: AI Agent (`useAgentGateway`)
- 🔶 Mission 17: Notifications (`useNotificationsGateway`)

### Usage Example

```typescript
// Using a gateway hook in your component
import { useMaintenanceGateway } from '@casa/api';

function MaintenanceScreen() {
  const {
    items,
    loading,
    isGateway, // true until Mission 09 implemented
    navigateToMaintenanceList,
    navigateToCreateMaintenance,
    submitRequest,
  } = useMaintenanceGateway(tenancyId);

  // Gateway hooks return placeholder data but navigation works
  // When Mission 09 is complete, same API returns real data
}
```

---

## Critical Flow: Tenant Onboarding

The most important end-to-end flow for launch:

```
1. Owner creates property (Mission 03)
   └── Property saved in database

2. Owner creates listing (Mission 04)
   └── Listing published, searchable

3. Tenant searches listings (Mission 04)
   └── Finds property, views details

4. Tenant submits application (Mission 05)
   └── Application with documents saved
   └── Owner notified

5. Owner reviews & approves (Mission 05)
   └── Application status → approved

6. Owner creates tenancy (Mission 06)
   └── Tenancy created with lease dates
   └── Tenant linked via tenancy_tenants
   └── **Rent schedule generated** ← NEW

7. Tenant sees rent due (Mission 07)
   └── Rent tab shows upcoming payments
   └── Can pay immediately or enable auto-pay

8. Tenant pays rent (Mission 07)
   └── Stripe payment processed
   └── Owner receives funds
   └── Schedule marked as paid
```

---

## Files Reference

### Gateway Hooks Location
```
packages/api/src/hooks/gateways/
├── index.ts                    # Re-exports all gateways
├── useArrearsGateway.ts        # Mission 08
├── useMaintenanceGateway.ts    # Mission 09
├── useTradesGateway.ts         # Mission 10
├── useInspectionsGateway.ts    # Mission 11
├── useMessagesGateway.ts       # Mission 12
├── useAgentGateway.ts          # Mission 14
└── useNotificationsGateway.ts  # Mission 17
```

### Gateway Types Location
```
packages/api/src/types/gateways.ts
```

### Key Implemented Files
```
packages/api/src/hooks/
├── useTenancyMutations.ts      # Creates tenancy + generates rent schedule
├── useRentSchedule.ts          # Fetches rent schedule for tenant
├── useMyTenancy.ts             # Tenant's active tenancy
├── useApplicationMutations.ts  # Approve/reject applications
└── usePaymentMutations.ts      # Process payments
```

---

## State-Specific Compliance

Several flows have state-specific requirements (NSW/VIC/QLD):

| Flow | NSW | VIC | QLD |
|------|-----|-----|-----|
| Rent increase notice | 60 days | 60 days | 60 days |
| Routine inspection interval | 6 months | 6 months | 3 months |
| Inspection notice | 7 days | 7 days | 7 days |
| Bond lodgement | Fair Trading | RTBA | RTA |
| Breach notice | 14 days | 14 days | 7 days |

These are configured in:
- `packages/api/src/constants/rentIncreaseRules.ts`
- `specs/ralph-missions/MISSION-11-inspections.md` (INSPECTION_RULES)

---

## Next Steps for Full Implementation

When implementing a gateway mission, follow this process:

1. **Read the mission document** in `specs/ralph-missions/`
2. **Create database migration** for new tables
3. **Implement the real hook** to replace gateway placeholder
4. **Update gateway hook** to use real implementation
5. **Add tests** for the new functionality
6. **Test the full flow** on device via Expo Go

The gateway hooks ensure navigation and UI can be built before the backend is complete.
