# Requirements: GovTrace

**Defined:** 2026-04-04
**Core Value:** Anyone can search a name and instantly trace the flow of money and influence across all public government datasets — with clarity a 9-year-old could follow.

## v2 Requirements

Requirements for v2.0 International Money Tracking milestone.

### International Aid

- [ ] **INTL-01**: User can see international aid projects on entity profiles (recipient, amount, funding department)
- [ ] **INTL-02**: Aid recipient organizations are entity-matched against existing domestic entities
- [ ] **INTL-03**: Entity profiles show international aid alongside domestic data ("received $X in overseas aid AND donated $Y to political parties")
- [ ] **INTL-04**: Search results include international aid data in entity counts
- [ ] **INTL-05**: How It Works page is updated to explain the 6th dataset (IATI Activity Files)

### Debt & Spending

- [ ] **DEBT-01**: Dashboard page shows current national debt alongside total overseas aid spending
- [ ] **DEBT-02**: Timeline visualization compares annual aid commitments against debt growth with election year markers
- [ ] **DEBT-03**: Department-level breakdown shows which departments authorize the most international spending
- [ ] **DEBT-04**: All numbers link to source data (Statistics Canada, Global Affairs, Dept of Finance)

### Parliamentary Voting

- [ ] **PARL-01**: Voting records from House of Commons Open Data are ingested for all parliaments since 2001
- [ ] **PARL-02**: Politician entity profiles show a "Votes" tab listing every bill they voted on (Yea/Nay/Absent)
- [ ] **PARL-03**: Bills are searchable — search "Bill C-69" and see all MPs who voted, grouped by party and position
- [ ] **PARL-04**: AI summary for politicians includes voting pattern insights cross-referenced with donors
- [ ] **PARL-05**: Every bill has an AI-generated plain-language summary explaining what it does — grandpa-readable

## Out of Scope

| Feature | Reason |
|---------|--------|
| Provincial/territorial data | Federal-only for v2; provincial datasets have different formats per province |
| Real-time parliamentary monitoring | Historical records only; live feeds add complexity without core value |
| Bill amendment tracking | Vote outcomes sufficient for v2; amendment history is a v3 candidate |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTL-01 | Phase 5 | Pending |
| INTL-02 | Phase 5 | Pending |
| INTL-03 | Phase 5 | Pending |
| INTL-04 | Phase 5 | Pending |
| INTL-05 | Phase 5 | Pending |
| DEBT-01 | Phase 6 | Pending |
| DEBT-02 | Phase 6 | Pending |
| DEBT-03 | Phase 6 | Pending |
| DEBT-04 | Phase 6 | Pending |
| PARL-01 | Phase 7 | Pending |
| PARL-02 | Phase 7 | Pending |
| PARL-03 | Phase 7 | Pending |
| PARL-04 | Phase 7 | Pending |
| PARL-05 | Phase 7 | Pending |

**Coverage:**
- v2 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after v2.0 milestone start*
