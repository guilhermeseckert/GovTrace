/**
 * Canadian federal election dates since 1993.
 * Hardcoded as immutable historical fact — Elections Canada has no machine-readable API.
 * Verified against Elections Canada Past Elections page:
 * https://www.elections.ca/content.aspx?section=ele&dir=pas&document=index&lang=e
 */
export const FEDERAL_ELECTION_DATES = [
  { election: '35th', date: '1993-10-25', year: 1993, winner: 'Liberal' },
  { election: '36th', date: '1997-06-02', year: 1997, winner: 'Liberal' },
  { election: '37th', date: '2000-11-27', year: 2000, winner: 'Liberal' },
  { election: '38th', date: '2004-06-28', year: 2004, winner: 'Liberal' },
  { election: '39th', date: '2006-01-23', year: 2006, winner: 'Conservative' },
  { election: '40th', date: '2008-10-14', year: 2008, winner: 'Conservative' },
  { election: '41st', date: '2011-05-02', year: 2011, winner: 'Conservative' },
  { election: '42nd', date: '2015-10-19', year: 2015, winner: 'Liberal' },
  { election: '43rd', date: '2019-10-21', year: 2019, winner: 'Liberal' },
  { election: '44th', date: '2021-09-20', year: 2021, winner: 'Liberal' },
  { election: '45th', date: '2025-04-28', year: 2025, winner: 'Liberal' },
] as const
