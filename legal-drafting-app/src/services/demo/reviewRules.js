/**
 * DEMO review rules for imported text (no field tokens). Structural checks
 * only: placeholders, blank signature lines, incomplete addresses, date-format
 * consistency, notice wording, extraction length. They never state that a
 * document is legally valid or invalid.
 */
const PLACEHOLDER = /\[[^\]\n]{2,60}\]/g;
const NUMERIC_DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/;
const TEXT_DATE =
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i;
const SIGNATURE_LINE =
  /^(?=.*(signature|licensor|licensee|landlord|tenant|deponent|complainant|petitioner|witness|अभिसाक्षी|प्रतिज्ञापत्रकर्ता)).*_{5,}/im;
const ADDRESS_GAP = /(residing at|resident of|address:?|निवासी|राहणार)\s*(\[[^\]]*\]|_{3,}|,)/i;

export function runReviewRules(text) {
  const findings = [];
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;

  if (words < 40) {
    findings.push({
      id: 'review:short',
      category: 'completeness',
      severity: 'high',
      title: 'Very little text',
      explanation: `Only ${words} word${words === 1 ? '' : 's'} are available for review.`,
      location: null,
      suggestedAction:
        'Check the extracted text and add any missing content before relying on the review.',
    });
  }

  const address = ADDRESS_GAP.exec(text);
  if (address) {
    findings.push({
      id: 'review:address',
      category: 'completeness',
      severity: 'medium',
      title: 'Party address is incomplete',
      explanation: 'An address after “' + address[1] + '” is blank or still a placeholder.',
      location: { kind: 'text', text: address[0].slice(0, 40), label: 'Party details' },
      suggestedAction: 'Add the full address of the party.',
    });
  }

  const placeholders = [...new Set(text.match(PLACEHOLDER) ?? [])];
  placeholders.slice(0, 6).forEach((ph) =>
    findings.push({
      id: `review:placeholder:${ph}`,
      category: 'placeholders',
      severity: 'medium',
      title: 'An unresolved placeholder remains',
      explanation: `${ph} still needs to be replaced with the actual detail.`,
      location: { kind: 'text', text: ph, label: 'Document text' },
      suggestedAction: 'Replace the placeholder, or remove it if it does not apply.',
    }),
  );

  if (SIGNATURE_LINE.test(text)) {
    findings.push({
      id: 'review:signature',
      category: 'completeness',
      severity: 'medium',
      title: 'Signature block appears empty',
      explanation: 'One or more signature lines are blank in the extracted text.',
      location: { kind: 'text', text: '_____', label: 'Signature block' },
      suggestedAction:
        'Confirm whether the original is signed. The text copy may not show signatures.',
    });
  }

  if (NUMERIC_DATE.test(text) && TEXT_DATE.test(text)) {
    findings.push({
      id: 'review:date-format',
      category: 'consistency',
      severity: 'low',
      title: 'Document contains inconsistent date formatting',
      explanation: `Dates appear both as “${NUMERIC_DATE.exec(text)[0]}” and “${TEXT_DATE.exec(text)[0]}”.`,
      location: { kind: 'text', text: NUMERIC_DATE.exec(text)[0], label: 'Dates' },
      suggestedAction: 'Use one date format throughout the document.',
    });
  }

  const termination = /[^\n.]*terminat[^\n]*/i.exec(text);
  if (
    termination &&
    !/\b(\d+|one|two|three|thirty|fifteen|seven)\b[^.\n]{0,20}\b(day|days|week|weeks|month|months|month's)\b/i.test(
      termination[0],
    )
  ) {
    findings.push({
      id: 'review:termination',
      category: 'risks',
      severity: 'low',
      title: 'Termination section may require review',
      explanation: 'The termination wording does not state a notice period.',
      location: { kind: 'text', text: termination[0].trim().slice(0, 40), label: 'Termination' },
      suggestedAction: 'Check whether a notice period and conditions should be stated.',
    });
  }

  return findings;
}
