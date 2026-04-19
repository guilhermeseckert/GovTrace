/**
 * Maps Open Canada bilingual department codes to readable English names.
 * Codes appear in contracts, grants, travel, hospitality CSVs as "eng-fra" format.
 */

const DEPARTMENT_MAP: Record<string, string> = {
  'aafc-aac': 'Agriculture and Agri-Food Canada',
  'acoa-apeca': 'Atlantic Canada Opportunities Agency',
  'atssc-scdata': 'Administrative Tribunals Support Service',
  'cannor': 'Canadian Northern Economic Development Agency',
  'cas-satj': 'Courts Administration Service',
  'casdo-ocena': 'Accessibility Standards Canada',
  'cbsa-asfc': 'Canada Border Services Agency',
  'ccohs-cchst': 'Canadian Centre for Occupational Health and Safety',
  'ced-dec': 'Canada Economic Development for Quebec Regions',
  'cer-rec': 'Canada Energy Regulator',
  'cfia-acia': 'Canadian Food Inspection Agency',
  'cic': 'Immigration, Refugees and Citizenship Canada',
  'cics-scic': 'Canadian Intergovernmental Conference Secretariat',
  'cihr-irsc': 'Canadian Institutes of Health Research',
  'cnsc-ccsn': 'Canadian Nuclear Safety Commission',
  'cpc-cpp': 'Civilian Review and Complaints Commission',
  'cra-arc': 'Canada Revenue Agency',
  'crtc': 'Canadian Radio-television and Telecommunications Commission',
  'csc-scc': 'Correctional Service of Canada',
  'cta-otc': 'Canadian Transportation Agency',
  'dfatd-maecd': 'Global Affairs Canada',
  'dfo-mpo': 'Fisheries and Oceans Canada',
  'dnd-mdn': 'National Defence',
  'ec': 'Environment and Climate Change Canada',
  'elections': 'Elections Canada',
  'erc-cee': 'Energy Regulator of Canada',
  'esdc-edsc': 'Employment and Social Development Canada',
  'fcac-acfc': 'Financial Consumer Agency of Canada',
  'feddevontario': 'Federal Economic Development Agency for Southern Ontario',
  'fednor': 'Federal Economic Development Agency for Northern Ontario',
  'fin': 'Department of Finance Canada',
  'hc-sc': 'Health Canada',
  'ic': 'Innovation, Science and Economic Development Canada',
  'inac-ainc': 'Crown-Indigenous Relations and Northern Affairs',
  'irb-cisr': 'Immigration and Refugee Board',
  'isc-sac': 'Indigenous Services Canada',
  'jus': 'Department of Justice Canada',
  'lac-bac': 'Library and Archives Canada',
  'nrc-cnrc': 'National Research Council Canada',
  'nrcan-rncan': 'Natural Resources Canada',
  'nserc-crsng': 'Natural Sciences and Engineering Research Council',
  'oci-bec': 'Office of the Correctional Investigator',
  'osfi-bsif': 'Office of the Superintendent of Financial Institutions',
  'pacificcan': 'Pacific Economic Development Canada',
  'pc': 'Parks Canada',
  'pch': 'Canadian Heritage',
  'phac-aspc': 'Public Health Agency of Canada',
  'ppsc-sppc': 'Public Prosecution Service of Canada',
  'praedcan': 'Prairies Economic Development Canada',
  'ps-sp': 'Public Safety Canada',
  'psc-cfp': 'Public Service Commission',
  'pwgsc-tpsgc': 'Public Services and Procurement Canada',
  'rcmp-grc': 'Royal Canadian Mounted Police',
  'ssc-spc': 'Shared Services Canada',
  'statcan': 'Statistics Canada',
  'tbs-sct': 'Treasury Board of Canada Secretariat',
  'tc': 'Transport Canada',
  'vac-acc': 'Veterans Affairs Canada',
  'vrab-tacra': 'Veterans Review and Appeal Board',
  'wd-deo': 'Western Economic Diversification Canada',
  'ngc-mbac': 'National Gallery of Canada',
  'csa-asc': 'Canadian Space Agency',
  'swc-cfc': 'Women and Gender Equality Canada',
  'pco-bcp': 'Privy Council Office',
  'csps-efpc': 'Canada School of Public Service',
  'wage-fegc': 'Women and Gender Equality Canada',
  'catsa-acsta': 'Canadian Air Transport Security Authority',
  'bdc-bdc': 'Business Development Bank of Canada',
  'edc-edc': 'Export Development Canada',
  'cdev': 'Canada Development Investment Corporation',
  'pbc-clcc': 'Parole Board of Canada',
}

/**
 * Resolves a department code to a readable English name.
 * Falls back to the original code if no mapping exists.
 */
export function getDepartmentName(code: string): string {
  if (!code) return ''
  const lower = code.toLowerCase().trim()
  return DEPARTMENT_MAP[lower] ?? code
}
