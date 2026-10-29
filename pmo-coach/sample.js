/*
 * Sample program for the Program Creation & PMO Coach.
 * "Northbridge Bank" and everyone in it are fictional. Dates are stored as day
 * offsets from today so the sample always looks current.
 */
window.SAMPLE_PROGRAM = {
  name: 'Digital Customer Onboarding Program',
  organisation: 'Northbridge Bank (fictional)',
  sponsor: 'Helen Achebe, Chief Operating Officer',
  manager: 'Marcus Lee, Program Director',
  problem: 'Opening a current account takes an average of 9 days and needs a branch visit for one customer in three. Around 38% of applicants abandon the process, and manual identity checks cost the bank £4.2m a year. Competitors now onboard customers in under 10 minutes on mobile.',
  objectives: [
    'Cut account opening time from 9 days to under 15 minutes for 80% of applicants by September 2027',
    'Reduce application abandonment from 38% to below 15% within six months of launch',
    'Remove branch visits for identity checks for at least 90% of customers by launch'
  ],
  scopeIn: 'Personal current and savings accounts; mobile app and web onboarding; digital identity verification; migration of in-flight applications; operations and contact centre readiness.',
  scopeOut: 'Business accounts, mortgages and credit cards; changes to the core banking platform; branch network changes.',
  benefits: [
    '£3.1m a year saving from automated identity checks',
    '£6.5m a year additional deposit income from higher completion rates',
    'Customer satisfaction for onboarding up from 61 to 80 (CSAT)'
  ],
  costs: 'Total investment £8.4m over 18 months: technology £4.9m, people £2.6m, contingency £0.9m. Payback expected within 14 months of launch.',
  timeline: 'Mobilise November 2026; build and integrate to May 2027; pilot with 5,000 customers June 2027; national launch September 2027.',
  risks: [
    'Identity verification vendor cannot meet UK regulatory standards in time',
    'Legacy application data quality delays migration',
    'Operations teams not ready for new exception handling volumes'
  ],
  projects: [
    {
      id: 'idv', name: 'Identity Verification Platform', lead: 'Priya Nair',
      goal: 'Deliver automated document and biometric identity checks that pass FCA requirements for 90% of applicants without manual review.',
      start: -60, end: 190,
      status: {
        date: -2, rag: 'Amber',
        summary: 'Vendor integration is two weeks behind because the liveness check API failed security testing.',
        pathToGreen: 'Vendor to ship patched API by next Friday; security retest booked for the following Tuesday; on track to recover by the end of sprint 9.',
        actionsThisWeek: [
          { text: 'Agree patch delivery date and fixes with vendor', owner: 'Priya Nair', due: 2 },
          { text: 'Book security penetration retest', owner: 'Tom Briggs', due: 3 },
          { text: 'Update integration plan and share with PMO', owner: 'Priya Nair', due: 4 }
        ],
        completedLastWeek: ['Completed document scanning integration in test', 'Signed data processing agreement with vendor', 'Ran first 500 synthetic identity checks (94% pass rate)'],
        raid: [
          { type: 'Risk', description: 'Patched API fails retest, delaying pilot readiness', owner: 'Priya Nair', nextStep: 'Agree fallback manual review volumes with Operations', due: 7 },
          { type: 'Issue', description: 'Liveness check API failed security testing', owner: 'Tom Briggs', nextStep: 'Retest once vendor patch is delivered', due: 10 },
          { type: 'Dependency', description: 'Mobile app SDK release needed for selfie capture', owner: 'Ana Costa', nextStep: 'Confirm SDK version in app release 4.2', due: 5 },
          { type: 'Assumption', description: 'FCA guidance on digital identity will not change before launch', owner: 'Rachel Kim', nextStep: 'Review at monthly regulatory horizon scan', due: 21 }
        ],
        critical: [
          { milestone: 'Vendor API patch delivered', date: 7, owner: 'Priya Nair', state: 'At risk' },
          { milestone: 'Security retest passed', date: 12, owner: 'Tom Briggs', state: 'At risk' },
          { milestone: 'End to end test with mobile app', date: 35, owner: 'Ana Costa', state: 'On track' },
          { milestone: 'Regulatory sign-off', date: 70, owner: 'Rachel Kim', state: 'On track' }
        ]
      }
    },
    {
      id: 'app', name: 'Mobile and Web Onboarding Journey', lead: 'Ana Costa',
      goal: 'Design and build a 10-minute onboarding journey in the mobile app and on the web, tested with real customers before launch.',
      start: -55, end: 200,
      status: {
        date: -2, rag: 'Green',
        summary: 'Design complete and usability tested; build is on plan with 3 of 8 screens in test.',
        pathToGreen: '',
        actionsThisWeek: [
          { text: 'Finish build of address lookup and income screens', owner: 'Dev team lead', due: 3 },
          { text: 'Run accessibility review of completed screens', owner: 'Ana Costa', due: 4 }
        ],
        completedLastWeek: ['Second round of usability testing with 12 customers', 'Signed off final designs with Marketing and Compliance'],
        raid: [
          { type: 'Risk', description: 'App store review delays release 4.2', owner: 'Ana Costa', nextStep: 'Submit for review a week earlier than planned', due: 30 },
          { type: 'Dependency', description: 'Identity verification SDK for selfie capture', owner: 'Priya Nair', nextStep: 'Confirm SDK version', due: 5 }
        ],
        critical: [
          { milestone: 'All screens in test', date: 21, owner: 'Ana Costa', state: 'On track' },
          { milestone: 'App release 4.2 submitted', date: 45, owner: 'Ana Costa', state: 'On track' },
          { milestone: 'Pilot release live', date: 120, owner: 'Ana Costa', state: 'On track' }
        ]
      }
    },
    {
      id: 'mig', name: 'Application Data Migration', lead: 'David Okafor',
      goal: 'Migrate all in-flight and historic applications into the new onboarding platform with no data loss and fully reconciled records.',
      start: -45, end: 160,
      status: {
        date: -3, rag: 'Red',
        summary: 'Trial migration found 22% of legacy records with missing or inconsistent address data, putting the March migration date at risk.',
        pathToGreen: 'Data cleansing squad of 4 starts Monday; automated address matching to fix 80% of errors by end of month; decision on manual fixes at steering group in two weeks. Back to Amber once error rate is below 5%.',
        actionsThisWeek: [
          { text: 'Mobilise data cleansing squad', owner: 'David Okafor', due: 1 },
          { text: 'Procure address matching service', owner: 'Procurement lead', due: 4 },
          { text: 'Draft options paper for steering group', owner: 'David Okafor', due: 5 }
        ],
        completedLastWeek: ['Ran trial migration of 50,000 records', 'Produced data quality error report by field'],
        raid: [
          { type: 'Issue', description: '22% of legacy records fail address validation', owner: 'David Okafor', nextStep: 'Cleanse with automated matching and manual review', due: 21 },
          { type: 'Risk', description: 'Cleansing effort exceeds budget by £180k', owner: 'Marcus Lee', nextStep: 'Request contingency drawdown at steering group', due: 14 },
          { type: 'Decision', description: 'Whether to migrate historic applications older than 2 years', owner: 'Helen Achebe', nextStep: 'Present options at steering group', due: 14 },
          { type: 'Dependency', description: 'Access to legacy database extract from IT operations', owner: 'IT Ops manager', nextStep: 'Confirm weekly extract schedule', due: 3 }
        ],
        critical: [
          { milestone: 'Data cleansing complete', date: 30, owner: 'David Okafor', state: 'At risk' },
          { milestone: 'Second trial migration', date: 45, owner: 'David Okafor', state: 'At risk' },
          { milestone: 'Production migration', date: 140, owner: 'David Okafor', state: 'Off track' }
        ]
      }
    },
    {
      id: 'reg', name: 'Regulatory and Compliance Readiness', lead: 'Rachel Kim',
      goal: 'Secure Compliance, Risk and FCA-aligned approvals for the new onboarding journey, including financial crime controls.',
      start: -40, end: 180,
      status: {
        date: -1, rag: 'Amber',
        summary: 'Financial crime control design is late because the screening rules owner left the bank.',
        pathToGreen: 'Interim owner named this week; control design workshop in 10 days; sign-off moved by 2 weeks with no impact on pilot date.',
        actionsThisWeek: [
          { text: 'Confirm interim owner for screening rules', owner: 'Rachel Kim', due: 2 },
          { text: 'Schedule control design workshop', owner: 'Rachel Kim', due: 3 }
        ],
        completedLastWeek: ['Completed data protection impact assessment', 'Briefed Second Line Risk on program scope'],
        raid: [
          { type: 'Issue', description: 'No owner for financial crime screening rules', owner: 'Rachel Kim', nextStep: 'Appoint interim owner', due: 2 },
          { type: 'Risk', description: 'Compliance sign-off slips past pilot start', owner: 'Rachel Kim', nextStep: 'Weekly check-in with Second Line Risk', due: 7 }
        ],
        critical: [
          { milestone: 'Control design signed off', date: 24, owner: 'Rachel Kim', state: 'At risk' },
          { milestone: 'Compliance approval for pilot', date: 95, owner: 'Rachel Kim', state: 'On track' }
        ]
      }
    },
    {
      id: 'ops', name: 'Operations Readiness and Training', lead: 'Grace Mensah',
      goal: 'Prepare operations and contact centre teams to handle digital onboarding exceptions, with new processes, staffing and training in place for pilot.',
      start: -20, end: 210,
      status: {
        date: -2, rag: 'Green',
        summary: 'Exception handling processes drafted; training needs analysis complete.',
        pathToGreen: '',
        actionsThisWeek: [
          { text: 'Review draft exception processes with team leaders', owner: 'Grace Mensah', due: 3 },
          { text: 'Agree pilot staffing model with Workforce Planning', owner: 'Grace Mensah', due: 5 }
        ],
        completedLastWeek: ['Completed training needs analysis for 140 staff'],
        raid: [
          { type: 'Risk', description: 'Exception volumes higher than forecast if identity pass rate is low', owner: 'Grace Mensah', nextStep: 'Model volumes at 85% and 90% pass rates', due: 10 }
        ],
        critical: [
          { milestone: 'Processes signed off', date: 28, owner: 'Grace Mensah', state: 'On track' },
          { milestone: 'Pilot team trained', date: 110, owner: 'Grace Mensah', state: 'On track' }
        ]
      }
    },
    {
      id: 'crm', name: 'CRM and Core Systems Integration', lead: 'Sam Patel',
      goal: 'Connect the new onboarding platform to the CRM and core banking systems so new customers are set up automatically with no rekeying.',
      start: -50, end: 170,
      status: {
        date: -9, rag: 'Green',
        summary: 'CRM interface built and passing tests; core banking interface design agreed.',
        pathToGreen: '',
        actionsThisWeek: [
          { text: 'Start build of core banking account creation interface', owner: 'Sam Patel', due: 4 }
        ],
        completedLastWeek: ['CRM interface passed system testing', 'Agreed core banking message formats with platform team'],
        raid: [
          { type: 'Dependency', description: 'Core banking test environment availability', owner: 'Platform team lead', nextStep: 'Book environment slots for November', due: 6 }
        ],
        critical: [
          { milestone: 'Core banking interface built', date: 40, owner: 'Sam Patel', state: 'On track' },
          { milestone: 'End to end integration test', date: 75, owner: 'Sam Patel', state: 'On track' }
        ]
      }
    }
  ]
};
