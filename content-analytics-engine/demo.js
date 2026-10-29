/*
 * Demo data for the Content Creation Analytics Engine.
 * Ten fictional videos and comments for the topic "personal finance in the UK".
 * Channels, titles and comments are invented to show how the engine works
 * without a YouTube API key. Publish times are set relative to "now" at runtime.
 */
window.DEMO_TOPIC = 'most engaged topics in personal finance in the UK today';
window.DEMO_VIDEOS = [
  {
    id: 'demo01', channel: 'Pound Sense', hoursAgo: 6, views: 184000, likes: 9100, commentCount: 1240,
    title: 'Cash ISA allowance cut? What the Budget rumours mean for your savings',
    tags: ['cash isa', 'isa allowance', 'budget', 'savings', 'uk personal finance'],
    description: 'Reports suggest the cash ISA allowance could be cut from £20,000. We look at what that means for savers, whether to move money into a stocks and shares ISA, and what to do before the Budget.',
    comments: [
      ['Moved my whole emergency fund into a cash ISA last year, now this. Should I switch to stocks and shares ISA?', 420],
      ['If they cut the cash ISA allowance most people will just pay tax on savings interest', 310],
      ['Great breakdown. Can you do a video on Lifetime ISA vs pension for first time buyers?', 205],
      ['The Budget always targets savers and pensions, never spending', 188],
      ['Is it worth filling the ISA allowance now before any change?', 160],
      ['Stocks and shares ISA is the better long term option anyway', 97],
      ['Savings rates are already dropping, this is a double hit', 85]
    ]
  },
  {
    id: 'demo02', channel: 'The Money Kitchen', hoursAgo: 9, views: 151000, likes: 7600, commentCount: 1490,
    title: 'Mortgage rates just moved again. Fix for 2 years or 5?',
    tags: ['mortgage rates', 'remortgage', 'fixed rate', 'interest rates', 'bank of england'],
    description: 'Lenders repriced their fixed rate mortgages this week. We compare two year and five year fixes, tracker deals, and what the Bank of England interest rate decision could mean for your remortgage.',
    comments: [
      ['My fixed rate ends in March, I am terrified of the remortgage', 512],
      ['Five year fix every time, sleep at night', 340],
      ['Tracker mortgage worked out cheaper for me this year', 221],
      ['Can you cover overpaying the mortgage vs investing in a stocks and shares ISA?', 198],
      ['Interest rates need to come down faster, first time buyers are priced out', 176],
      ['Broker told me to lock in a mortgage rate now and switch later if rates fall', 133]
    ]
  },
  {
    id: 'demo03', channel: 'Retire Ready UK', hoursAgo: 4, views: 98000, likes: 6200, commentCount: 1720,
    title: 'Pension tax free lump sum: should you take it before the Budget?',
    tags: ['pension', 'tax free lump sum', 'budget', 'retirement', 'salary sacrifice'],
    description: 'Speculation about changes to the pension tax free lump sum and salary sacrifice is causing people to withdraw early. We explain the risks and the tax rules.',
    comments: [
      ['Withdrawing your pension lump sum out of fear is a mistake, the tax hit can be huge', 640],
      ['My employer salary sacrifice scheme saves me hundreds, please do not touch it', 455],
      ['Every Budget the same pension rumours', 290],
      ['Is it better to put a bonus into my pension or into an ISA?', 240],
      ['Pension vs Lifetime ISA video please', 150],
      ['State pension age keeps moving, we need certainty', 121]
    ]
  },
  {
    id: 'demo04', channel: 'Frugal North', hoursAgo: 11, views: 120000, likes: 5400, commentCount: 980,
    title: 'Energy bills are going up again in January. 7 ways to cut costs',
    tags: ['energy bills', 'price cap', 'cost of living', 'save money', 'budgeting'],
    description: 'The new energy price cap means higher energy bills from January. Practical tips to reduce costs, check your tariff and manage the cost of living this winter.',
    comments: [
      ['The energy price cap going up again is brutal for pensioners', 380],
      ['Switched to a fixed energy tariff last month, glad I did', 260],
      ['Cost of living is still crushing families, wages have not caught up', 244],
      ['Great tips. Budgeting apps helped me more than anything', 140],
      ['Food prices and energy bills together are the real problem', 132],
      ['Can you do one on building an emergency fund on a low income?', 118]
    ]
  },
  {
    id: 'demo05', channel: 'Pound Sense', hoursAgo: 15, views: 76000, likes: 4900, commentCount: 860,
    title: 'Stocks and shares ISA for beginners: index funds explained',
    tags: ['stocks and shares isa', 'index funds', 'investing', 'isa', 'beginners'],
    description: 'A simple guide to opening a stocks and shares ISA, choosing a global index fund, and why fees matter. Plus what a cut to the cash ISA allowance could mean.',
    comments: [
      ['Finally moved from cash ISA to stocks and shares ISA thanks to this', 298],
      ['Which platform has the lowest fees for a stocks and shares ISA?', 260],
      ['Global index fund and forget about it, best advice', 190],
      ['If the cash ISA allowance is cut this video will blow up', 125],
      ['Is now a bad time to invest with interest rates still high?', 98]
    ]
  },
  {
    id: 'demo06', channel: 'Side Income Sam', hoursAgo: 7, views: 132000, likes: 6800, commentCount: 1100,
    title: 'HMRC side hustle rules: do you need to pay tax on Vinted and Etsy?',
    tags: ['side hustle', 'hmrc', 'tax', 'self assessment', 'vinted'],
    description: 'New reporting rules mean platforms share seller data with HMRC. We explain the trading allowance, self assessment and when your side hustle income becomes taxable.',
    comments: [
      ['So selling my old clothes on Vinted is fine but buying to resell is a side hustle?', 470],
      ['The £1,000 trading allowance has not changed in years, it should go up', 315],
      ['Self assessment deadline is coming, thanks for the reminder', 190],
      ['HMRC chasing small sellers while big companies avoid tax', 255],
      ['Can you explain income tax thresholds being frozen next?', 140]
    ]
  },
  {
    id: 'demo07', channel: 'The Money Kitchen', hoursAgo: 13, views: 88000, likes: 4300, commentCount: 1310,
    title: 'Frozen income tax thresholds: the stealth tax costing you £1,000s',
    tags: ['income tax', 'tax thresholds', 'budget', 'fiscal drag', 'tax'],
    description: 'Income tax thresholds are frozen, so pay rises pull more people into higher rate tax. How fiscal drag works, and how pension contributions and salary sacrifice can help.',
    comments: [
      ['Got a pay rise and ended up in the higher rate tax band, barely better off', 520],
      ['Frozen income tax thresholds are a tax rise by another name', 410],
      ['Salary sacrifice into my pension is the only way to keep under the threshold', 280],
      ['The Budget should unfreeze the thresholds, will not happen though', 160],
      ['Child benefit tax charge is the worst part of this', 150]
    ]
  },
  {
    id: 'demo08', channel: 'Frugal North', hoursAgo: 18, views: 64000, likes: 3900, commentCount: 720,
    title: 'Best easy access savings accounts this week (rates are falling)',
    tags: ['savings accounts', 'savings rates', 'easy access', 'emergency fund', 'cash isa'],
    description: 'Savings rates have started to fall. The best easy access savings accounts and cash ISA rates right now, and where to keep your emergency fund.',
    comments: [
      ['Savings rates falling while energy bills rise, great', 230],
      ['Keep the emergency fund in easy access, invest the rest', 170],
      ['Is a cash ISA still worth it if rates keep dropping?', 160],
      ['Premium bonds vs savings account video please', 110]
    ]
  },
  {
    id: 'demo09', channel: 'First Home Fund', hoursAgo: 20, views: 59000, likes: 3600, commentCount: 690,
    title: 'First time buyer in 2026? Lifetime ISA, deposits and mortgage rates',
    tags: ['first time buyer', 'lifetime isa', 'mortgage rates', 'house deposit', 'property'],
    description: 'How to save a house deposit with a Lifetime ISA, the property price cap problem, and what current mortgage rates mean for first time buyers.',
    comments: [
      ['The Lifetime ISA property price cap needs raising, it is useless in London', 330],
      ['Mortgage rates make first time buyers wait even longer', 210],
      ['Lifetime ISA bonus helped me buy my flat', 140],
      ['Rent is so high it is impossible to save a deposit', 135]
    ]
  },
  {
    id: 'demo10', channel: 'Retire Ready UK', hoursAgo: 22, views: 52000, likes: 3100, commentCount: 640,
    title: 'State pension triple lock explained: will it survive?',
    tags: ['state pension', 'triple lock', 'pension', 'retirement', 'budget'],
    description: 'The triple lock means a state pension rise every year, but the cost is under scrutiny ahead of the Budget. What could change and how to plan your retirement.',
    comments: [
      ['Pensioners paid in all their lives, keep the triple lock', 300],
      ['Younger people will never see the same state pension', 260],
      ['Private pension contributions matter more than ever', 120],
      ['Energy bills for pensioners should be part of this conversation', 95]
    ]
  }
];
