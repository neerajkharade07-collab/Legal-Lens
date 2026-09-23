/**
 * LegalLens — Legal Help dashboard: static content.
 *
 * Answers are NOT stored here any more — every question (typed or from a card)
 * is answered live by the Legal Lens backend (POST /api/guidance/chat).
 *
 * What remains here:
 *   - the four suggested questions shown as cards
 *   - REAL official government links shown under answers to those questions
 *   - FICTIONAL demo lawyers (isDemo: true) — none of them are real people
 *   - UI messages
 */
(function (global) {
  'use strict';


  var legalQueries = {
    tenantRights: {
      id: 'tenantRights',
      title: 'Tenant Rights',
      question: 'What are my rights as a tenant in India?',
      icon: 'home',
      governmentResources: [
        {
          name: 'Ministry of Housing & Urban Affairs',
          description: 'Official website of the Ministry of Housing & Urban Affairs, Government of India.',
          url: 'https://mohua.gov.in/',
          cta: 'Visit Website'
        }
      ],
      lawyers: [
        { name: 'Advocate Riya Sharma', practice: 'Property & Tenancy Law', city: 'Mumbai', isDemo: true },
        { name: 'Advocate Arjun Mehta', practice: 'Civil & Property Law', city: 'Pune', isDemo: true }
      ]
    },

    workplaceHarassment: {
      id: 'workplaceHarassment',
      title: 'Workplace Harassment',
      question: 'What can I do about workplace harassment?',
      icon: 'briefcase',
      governmentResources: [
        {
          name: 'SHe-Box — Government of India',
          description: 'Government of India online portal for registering complaints of sexual harassment at the workplace.',
          url: 'https://shebox.wcd.gov.in/',
          cta: 'Visit Official Portal'
        }
      ],
      lawyers: [
        { name: 'Advocate Neha Kapoor', practice: 'Employment Law', city: 'Mumbai', isDemo: true },
        { name: 'Advocate Karan Malhotra', practice: 'Labour & Employment Law', city: 'Pune', isDemo: true }
      ]
    },

    fileFIR: {
      id: 'fileFIR',
      title: 'File an FIR',
      question: 'How do I file an FIR online in my state?',
      icon: 'document',
      governmentResources: [
        {
          name: 'Digital Police — Ministry of Home Affairs',
          description: 'Ministry of Home Affairs portal with citizen services and links to state police websites.',
          url: 'https://digitalpolice.gov.in/',
          cta: 'Find My State Police Portal'
        }
      ],
      lawyers: [
        { name: 'Advocate Vikram Rao', practice: 'Criminal Law', city: 'Mumbai', isDemo: true },
        { name: 'Advocate Sameer Joshi', practice: 'Criminal & Cyber Law', city: 'Pune', isDemo: true }
      ]
    },

    womensLegalRights: {
      id: 'womensLegalRights',
      title: "Women's Legal Rights",
      question: 'What legal protections are available for women in India?',
      icon: 'people',
      governmentResources: [
        {
          name: 'National Commission for Women (NCW)',
          description: "Official government resource for women's rights, complaints and related assistance.",
          url: 'https://ncw.gov.in/',
          cta: 'Visit Website'
        },
        {
          name: 'National Legal Services Authority (NALSA)',
          description: 'Official resource for legal aid and legal services.',
          url: 'https://nalsa.gov.in/',
          cta: 'Visit Website'
        }
      ],
      lawyers: [
        {
          name: 'Advocate Anjali Rao',
          practice: "Women's Rights & Family Law",
          experience: '9 years experience',
          city: 'Mumbai',
          isDemo: true
        },
        {
          name: 'Advocate Sneha Kulkarni',
          practice: 'Family & Civil Law',
          experience: '7 years experience',
          city: 'Pune',
          isDemo: true
        }
      ]
    }
  };


  /**
   * SIH DEMO MODE — sample guidance shown ONLY when the live AI service
   * (POST /api/guidance/chat) cannot be reached or is not configured.
   * It is always labelled "Demo Mode — sample guidance, not live AI".
   * Deliberately general: no section numbers, case citations, deadlines or
   * amounts are stated here (those must come from a live answer or a lawyer).
   */
  var demoGuidance = {
    tenantRights:
      '## Sample guidance: tenant rights (general overview)\n' +
      '- Get the rental arrangement in writing and keep a signed copy. Rent, deposit, notice period and repair responsibilities should be spelled out in the agreement.\n' +
      '- Rent-control and tenancy rules differ from state to state, so check the rules that apply where the property is located.\n' +
      '- Keep proof of every payment (bank transfer records or signed receipts), including the security deposit.\n' +
      '- A landlord generally has to follow the agreement and the legal process to end a tenancy; cutting essential services or forcing you out without due process is something to raise with a lawyer or the authorities.\n' +
      '- Before moving in and when moving out, record the condition of the property (dated photos) to support a claim for the deposit.\n' +
      '\n' +
      'Next steps: gather the agreement, receipts and messages, then consult a lawyer or your District Legal Services Authority for advice on your specific facts.',
    workplaceHarassment:
      '## Sample guidance: workplace harassment (general overview)\n' +
      '- Write down each incident: date, time, place, what happened and who witnessed it. Keep emails, chats and other records.\n' +
      '- Check your employer\'s policy for how complaints are made. Many workplaces have an internal committee for complaints of sexual harassment.\n' +
      '- The Government of India SHe-Box portal (linked below) accepts complaints of sexual harassment at the workplace.\n' +
      '- If you face threats, violence or a crime, you can also approach the police.\n' +
      '\n' +
      'Next steps: keep your records safe and speak to an employment lawyer or a legal services authority about the options for your situation.',
    fileFIR:
      '## Sample guidance: filing an FIR (general overview)\n' +
      '- An FIR is filed with the police for cognizable offences. You can go to the police station with jurisdiction, and many states also offer online complaint services.\n' +
      '- Online services and what can be filed online differ by state; the Digital Police portal (linked below) links to state police websites.\n' +
      '- Give a clear written account: what happened, when and where, who was involved, and any evidence or witnesses. Ask for a copy of what is registered.\n' +
      '- If the police do not register your complaint, there are further remedies; a lawyer can advise which applies to your case.\n' +
      '\n' +
      'Next steps: note down the facts and keep evidence safe. In an emergency, contact the police immediately.',
    womensLegalRights:
      '## Sample guidance: legal protections for women (general overview)\n' +
      '- Indian law provides protections in areas such as domestic violence, workplace harassment, dowry, maintenance and equal treatment.\n' +
      '- The National Commission for Women (linked below) is an official body that receives complaints and provides information.\n' +
      '- Free legal aid is available to eligible persons through legal services authorities such as NALSA (linked below) and District Legal Services Authorities.\n' +
      '- In an emergency or if you are in danger, contact the police immediately.\n' +
      '\n' +
      'Next steps: write down what happened, keep any evidence safe and speak to a lawyer or a legal services authority about your options.'
  };

  var demoGeneric =
    '## Live AI guidance is not connected right now\n' +
    'In Demo Mode, LegalLens can only show prepared sample guidance for the four suggested topics (Tenant Rights, Workplace Harassment, File an FIR, Women\'s Legal Rights). Your question was not sent to an AI and has not been answered.\n' +
    '\n' +
    '- Choose one of the suggested topics to see sample guidance, or use "Try live AI again".\n' +
    '- For advice on your own situation, consult a qualified lawyer or your District Legal Services Authority.';

  /** Display order of the four suggestion cards. */
  var QUERY_ORDER = ['tenantRights', 'workplaceHarassment', 'fileFIR', 'womensLegalRights'];

  var MESSAGES = {
    comingSoonTitle: 'Feature coming soon',
    document: 'Document analysis is not available in this prototype. Try one of the suggested queries above.',
    voice: 'Voice assistance will be available in a future version. Try one of the suggested queries above.',
    invalidFile: 'Please choose a PDF, JPG, JPEG or PNG file.',
    emptyQuestion: 'Please enter a legal question.',
    tooLongQuestion: 'Please keep your question under 2000 characters.',
    thinking: 'LegalLens is thinking',
    replyLabel: 'LegalLens AI',
    retry: 'Try again',
    errorTitle: "Couldn't get a response",
    errors: {
      offline: 'You appear to be offline. Check your internet connection and try again.',
      unreachable:
        "Can't reach the Legal Lens server. Make sure the backend is running, then try again.",
      timeout: 'The response is taking longer than expected. Please try again.',
      'ai-failed': "The AI assistant couldn't generate a response right now. Please try again in a moment.",
      'not-configured': "AI legal guidance isn't set up on the server yet. Please try again later.",
      'rate-limited': 'Too many requests right now. Please wait a few minutes and try again.',
      'too-long': 'This conversation is too long to send. Start a new conversation and ask again.',
      invalid: 'Please enter a legal question.',
      unknown: 'Something went wrong. Please try again.'
    },
    resourcesTitle: 'Official Government Resources',
    lawyersTitle: 'Suggested Lawyers (Demo)',
    lawyerProfiles: 'Lawyer profiles coming soon.',
    lawyerDisclaimer: 'Profiles shown are fictional and included only for demonstration purposes.',
    demoLabel: 'LegalLens — Demo Mode',
    demoNotice:
      'Demo Mode — prepared sample guidance, not a live AI answer and not legal advice. The live AI service could not be reached or is not configured.',
    demoRetry: 'Try live AI again',
    pageDisclaimer:
      'LegalLens provides informational assistance and does not replace professional legal advice. Verify important legal matters with a qualified lawyer.'
  };

  global.LegalHelpData = {
    legalQueries: legalQueries,
    QUERY_ORDER: QUERY_ORDER,
    MESSAGES: MESSAGES,
    demoGuidance: demoGuidance,
    demoGeneric: demoGeneric
  };
})(window);
