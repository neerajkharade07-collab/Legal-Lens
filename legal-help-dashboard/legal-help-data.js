/**
 * LegalLens — Legal Help dashboard: static content.
 *
 * Answers are NOT stored here any more — every question (typed or from a card)
 * is answered live by the Legal Lens backend (POST /api/guidance/chat).
 *
 * What remains here:
 *   - the four suggested questions shown as cards
 *   - REAL official government links shown under answers to those questions
 *   - UI messages (voice input, documents, lawyer suggestions, quick follow-ups)
 * Lawyer suggestions are NOT stored here: they come from verified lawyers in
 * the Legal Lens database (the fictional demo lawyers were removed).
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
      ]
    }
  };


  // (The former "Demo Mode" sample answers were removed: when the live AI
  // fails, the page now shows an honest error with "Try again" instead.)

  /** Display order of the four suggestion cards. */
  var QUERY_ORDER = ['tenantRights', 'workplaceHarassment', 'fileFIR', 'womensLegalRights'];

  var MESSAGES = {
    comingSoonTitle: 'Feature coming soon',
    invalidFile: 'Please choose a PDF, DOCX, TXT, JPG or PNG file.',
    // ---- voice input ----
    voice: {
      listening: 'Listening… speak now',
      review: 'Check the text in the box, edit it if needed, then press Send.',
      reviewTitle: 'Voice text added',
      privacy: "Your browser converts speech to text (in Chrome and Edge this uses the browser's online speech service). Nothing is sent to Legal Lens until you press Send.",
      errorTitle: 'Voice input problem',
      unsupportedTitle: 'Voice input is not available in this browser',
      errors: {
        unsupported: 'This browser does not support speech-to-text. Please use Chrome or Edge (desktop or Android), or type your question.',
        insecure: 'Voice input needs a secure page (https or localhost). Please type your question.',
        'not-allowed': 'Microphone access was blocked. Allow the microphone for this site in your browser settings, or type your question.',
        'no-speech': "I didn't hear anything. Press the microphone and try again, speaking close to it.",
        'audio-capture': 'No microphone was found. Connect a microphone or type your question.',
        network: "Speech recognition needs an internet connection (it uses your browser's speech service). Check your connection or type your question.",
        'language-not-supported': "This browser can't recognise the selected language. Try English, or type your question.",
        'start-failed': 'Voice input could not start. Please try again or type your question.',
        unknown: 'Voice input stopped unexpectedly. Please try again or type your question.'
      }
    },
    // ---- documents ----
    documents: {
      reading: 'Reading',
      attachedLabel: 'Documents attached to this conversation',
      readByAI: 'read by AI from an image — check details',
      unreadablePages: 'no readable text on page',
      truncated: 'long document: only the beginning is used',
      maxReached: 'You can attach up to 3 documents in one conversation. Remove one first.',
      suggestedQuestion: 'Please explain the important points of this document for my situation: ',
      // Viewing the extracted text and incomplete documents
      viewText: 'View text',
      viewTextFor: 'View the text read from',
      incomplete: 'incomplete',
      incompleteTitle: 'Part of this document could not be read',
      incompleteHint: 'Answers can only use the text shown. Check the missing pages in the original, or upload a clearer copy.',
      incompleteFallback: 'Some of this document is missing from the text (pages could not be read, pages were over the limit, or the document is very long).',
      textTitle: 'Text read from this document',
      textIntro: 'This is the text Legal Lens extracted and uses for answers. Compare important names, numbers and dates with the original.',
      textLoading: 'Loading the text…',
      textClose: 'Close',
      textRetry: 'Try again',
      textCharacters: 'characters',
      textErrors: {
        notFound: 'This document is no longer available (deleted or expired). Upload it again if you need it.',
        auth: 'Please log in again to view this document.',
        offline: 'You appear to be offline. Check your connection and try again.',
        failed: "The text couldn't be loaded. Please try again."
      },
      readyNotice: 'Document read. Ask a question about it, or press Send to get an explanation.',
      errors: {
        'invalid-file': 'Please choose a PDF, DOCX, TXT, JPG or PNG file.',
        'file-too-large': 'This file is too large. The maximum size is 8 MB.',
        'auth-required': 'Please log in to your customer account to upload documents.',
        forbidden: 'Document upload is available for customer accounts only.',
        'rate-limited': 'Too many uploads right now. Please wait a few minutes and try again.',
        offline: 'You appear to be offline. Check your internet connection and try again.',
        unreachable: "Can't reach the Legal Lens server. Make sure the backend is running, then try again.",
        timeout: 'Reading the document took too long. Please try a smaller file.',
        'server-busy': 'The document reader is unavailable right now. Please try again later.',
        'upload-failed': 'The document could not be read. Please try again or use another file.'
      }
    },
    // ---- verified lawyers (from the Legal Lens database) ----
    lawyerSuggestions: {
      title: 'Approved lawyers on Legal Lens',
      inCity: 'Approved lawyers in',
      otherCities: 'No approved lawyer found in',
      showingOthers: 'Showing approved lawyers from other cities.',
      none: 'No approved lawyers for this area are listed on Legal Lens yet.',
      verified: 'Verified',
      reviewed: 'Reviewed by CASEONE',
      fee: 'Consultation fee',
      feeNotListed: 'Fee not listed',
      languages: 'Languages',
      disclaimer: 'Shown from lawyers registered and verified on Legal Lens. This is not an endorsement — check their details before you decide.',
      browse: 'Browse Lawyer Connect',
      viewProfile: 'View profile'
    },
    // ---- reply language (sent to the server; Auto = same language as the question) ----
    replyLanguage: {
      label: 'Reply language',
      hint: 'Language of the AI answers',
      options: [
        { code: 'auto', label: 'Auto (same as my question)' },
        { code: 'en', label: 'English' },
        { code: 'hi', label: 'हिंदी (Hindi)' },
        { code: 'mr', label: 'मराठी (Marathi)' }
      ],
      changed: 'Replies will be in'
    },
    // ---- chat sidebar ----
    sidebar: {
      label: 'Chats',
      newChat: 'New Chat',
      searchPlaceholder: 'Search chats',
      searchLabel: 'Search chats by title',
      collapse: 'Close sidebar',
      expand: 'Open sidebar',
      openMenu: 'Open chat list',
      closeMenu: 'Close chat list',
      loading: 'Loading chats…',
      empty: 'No chats yet. Ask a legal question to start one — it is saved here automatically.',
      error: "Couldn't load your chats. Check your connection and try again.",
      errorRefresh: "Couldn't refresh the chat list.",
      retry: 'Try again',
      signedOut: 'Log in to save your chats and see them here.',
      login: 'Log in',
      noMatch: 'No chats match',
      groupToday: 'Today',
      groupYesterday: 'Yesterday',
      groupWeek: 'Previous 7 days',
      groupMonth: 'Previous 30 days',
      groupOlder: 'Older',
      more: 'More options',
      moreFor: 'Options for',
      rename: 'Rename',
      renameLabel: 'New chat title',
      renameEmpty: 'Please enter a title.',
      renameTooLong: 'Please use at most 80 characters.',
      renameFailed: 'The chat could not be renamed. Please try again.',
      renamed: 'Chat renamed.',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      deleteTitle: 'Delete chat?',
      deleteText: 'This will permanently delete',
      deleteTextEnd: 'and the documents uploaded in it. Other chats are not affected.',
      deleteConfirm: 'Delete',
      deleting: 'Deleting…',
      deleteFailed: 'The chat could not be deleted. Please try again.',
      opening: 'Opening…',
      openFailed: "Couldn't open that chat. Your current chat is unchanged.",
      newChatTitle: 'New chat',
      footer: 'Chats are kept until you delete them (or 1 year without activity). Uploaded documents are deleted after 7 days.'
    },
    // ---- saved conversations (case history) ----
    newConversation: 'New conversation',
    savedConversations: 'Saved conversations',
    noSavedConversations: 'No saved conversations yet. Your conversations are saved automatically once you ask a question.',
    retention:
      'Conversations are saved to your account until you delete them (or automatically after 1 year without activity). ' +
      'Uploaded documents are kept separately for 7 days, then deleted; the conversation then only shows their names. ' +
      'Deleting a conversation also deletes the documents uploaded in it.',
    conversationOpened: 'Saved conversation opened:',
    conversationMissing: 'This conversation could not be opened. It may have been deleted.',
    conversationDeleted: 'Conversation deleted.',
    conversationDeleteFailed: 'The conversation could not be deleted. Please try again.',
    documentsExpired: 'No longer available (deleted or expired):',
    documentsExpiredHint: 'Upload them again if you need them.',
    conversationFull: 'This conversation has reached its length limit. Start a new conversation to continue — this one stays saved.',
    // ---- quick follow-ups shown under the latest answer ----
    quickActions: [
      { id: 'court', label: 'Prepare me for court', message: 'Help me prepare to present this case myself in court or before the right authority, step by step.' },
      { id: 'hindi', label: 'हिंदी में समझाएं', message: 'Please explain your last answer in Hindi.' },
      { id: 'marathi', label: 'मराठीत सांगा', message: 'Please explain your last answer in Marathi.' },
      { id: 'lawyer', label: 'Suggest a lawyer', message: 'Please suggest an approved lawyer on Legal Lens for my case.' }
    ],
    emptyQuestion: 'Please enter a legal question.',
    tooLongQuestion: 'Please keep your question under 2000 characters.',
    thinking: 'LegalLens is thinking',
    replyLabel: 'LegalLens AI',
    // Small tag next to the label, by reply type from the backend. Follow-up
    // questions are a normal part of the conversation, so they get no tag.
    replyTags: {
      draft: 'Draft',
      out_of_scope: 'Legal matters only'
    },
    retry: 'Try again',
    login: 'Log in',
    loginTitle: 'Log in to continue',
    errorTitle: "Couldn't get a response",
    errors: {
      offline: 'You appear to be offline. Check your internet connection and try again.',
      unreachable:
        "Can't reach the Legal Lens server. Make sure the backend is running, then try again.",
      timeout: 'The response is taking longer than expected. Please try again.',
      'ai-failed': "The AI assistant couldn't generate a response right now. Please try again in a moment.",
      'not-configured': "AI legal guidance isn't set up on the server yet. Please try again later.",
      'ai-quota': 'The AI service has reached its usage limit for now. Please try again later.',
      'ai-timeout': 'The AI took too long to answer. Please try again.',
      'ai-unavailable': 'The AI service is temporarily unavailable. Please try again in a few minutes.',
      'ai-empty': 'The AI returned an empty answer. Please try again.',
      'rate-limited': 'Too many requests right now. Please wait a few minutes and try again.',
      'too-long': 'This conversation is too long to send. Start a new conversation and ask again.',
      invalid: 'Please enter a legal question.',
      'auth-required': 'Please log in to your customer account to use AI Legal Guidance.',
      forbidden: 'AI Legal Guidance is available for customer accounts only.',
      'document-missing': 'An attached document is no longer available (it may have expired). Remove it and upload it again.',
      'conversation-full': 'This conversation has reached its length limit. Please start a new conversation.',
      'conversation-missing': 'This saved conversation no longer exists. Your question was not sent; please start a new conversation.',
      'ai-declined': 'The AI service could not answer this message. Please rephrase it and try again.',
      unknown: 'Something went wrong. Please try again.'
    },
    // Shown under every failed answer: nothing is invented when the AI fails.
    errorNoAnswer: 'No answer was generated for this question.',
    resourcesTitle: 'Official Government Resources',
    pageDisclaimer:
      'LegalLens provides informational assistance and does not replace professional legal advice. Verify important legal matters with a qualified lawyer.'
  };

  global.LegalHelpData = {
    legalQueries: legalQueries,
    QUERY_ORDER: QUERY_ORDER,
    MESSAGES: MESSAGES
  };
})(window);
